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

    // Simple approach: get all raw_items with video_url
    const { data: rawItemsWithVideo } = await db
      .from('raw_items')
      .select('url, video_url')
      .not('video_url', 'is', null)

    if (!rawItemsWithVideo || rawItemsWithVideo.length === 0) {
      return NextResponse.json({
        status: 'complete',
        rawItemsProcessed: 0,
        articlesUpdated: 0,
        message: 'No raw items with video found'
      })
    }

    console.log(`[extract-videos-retroactive] Found ${rawItemsWithVideo.length} raw items with video`)

    let articlesUpdated = 0

    // For each raw_item with video, get all articles that have this URL in sources
    for (const rawItem of rawItemsWithVideo) {
      try {
        if (!rawItem.video_url || !rawItem.url) continue

        // Get articles with this source URL and no video_url
        const { data: articles } = await db
          .from('articles')
          .select('id, sources')
          .is('video_url', null)

        if (!articles) continue

        // Filter articles that have matching source URL
        const matchingArticles = articles.filter(article => {
          const sources = Array.isArray(article.sources) ? article.sources : []
          return sources.some((s: any) => s?.url === rawItem.url)
        })

        // Update each matching article
        for (const article of matchingArticles) {
          const { error: updateError } = await db
            .from('articles')
            .update({ video_url: rawItem.video_url })
            .eq('id', article.id)

          if (!updateError) {
            articlesUpdated++
          }
        }
      } catch (err: any) {
        console.error(`[extract-videos-retroactive] Error:`, err.message)
      }
    }

    console.log(`[extract-videos-retroactive] Updated ${articlesUpdated} articles`)

    return NextResponse.json({
      status: 'complete',
      rawItemsProcessed: rawItemsWithVideo.length,
      articlesUpdated,
      message: `Successfully updated ${articlesUpdated} articles with video URLs`
    })
  } catch (err: any) {
    console.error(`[extract-videos-retroactive] Unexpected error:`, err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
