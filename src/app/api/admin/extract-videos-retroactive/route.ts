import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[extract-videos-retroactive] Starting retroactive video extraction`)

    const db = getSupabaseAdmin()

    // Get all articles that don't have video_url but have corresponding raw_items with video_url
    const { data: articlesWithoutVideo, error: fetchError } = await db
      .from('articles')
      .select('id, sources')
      .is('video_url', null)
      .order('cached_at', { ascending: false })

    if (fetchError) {
      console.error(`[extract-videos-retroactive] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!articlesWithoutVideo || articlesWithoutVideo.length === 0) {
      console.log(`[extract-videos-retroactive] No articles without video found`)
      return NextResponse.json({
        status: 'complete',
        articlesProcessed: 0,
        articlesUpdated: 0,
        message: 'No articles without video found'
      })
    }

    console.log(`[extract-videos-retroactive] Found ${articlesWithoutVideo.length} articles without video`)

    // For each article, try to find the source URL in raw_items and get the video_url
    let articlesUpdated = 0
    const failedUpdates: string[] = []

    for (const article of articlesWithoutVideo) {
      try {
        const sources = Array.isArray(article.sources) ? article.sources : []
        if (sources.length === 0) continue

        // Try to find video_url from any of the source URLs
        let foundVideoUrl: string | null = null

        for (const source of sources) {
          const { data: rawItem } = await db
            .from('raw_items')
            .select('video_url')
            .eq('url', source.url)
            .single()

          if (rawItem?.video_url) {
            foundVideoUrl = rawItem.video_url
            break
          }
        }

        // If found, update the article
        if (foundVideoUrl) {
          const { error: updateError } = await db
            .from('articles')
            .update({ video_url: foundVideoUrl })
            .eq('id', article.id)

          if (updateError) {
            console.error(`[extract-videos-retroactive] Update error for ${article.id}:`, updateError)
            failedUpdates.push(article.id)
          } else {
            articlesUpdated++
          }
        }
      } catch (err: any) {
        console.error(`[extract-videos-retroactive] Error processing ${article.id}:`, err.message)
        failedUpdates.push(article.id)
      }
    }

    console.log(`[extract-videos-retroactive] Updated ${articlesUpdated} articles`)

    return NextResponse.json({
      status: 'complete',
      articlesProcessed: articlesWithoutVideo.length,
      articlesUpdated,
      failedUpdates: failedUpdates.length > 0 ? failedUpdates.slice(0, 10) : undefined,
      message: `Successfully updated ${articlesUpdated} articles with video URLs`
    })
  } catch (err: any) {
    console.error(`[extract-videos-retroactive] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
