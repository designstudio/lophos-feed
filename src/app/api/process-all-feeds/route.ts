import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processRawBatch } from '@/lib/news'
import { randomUUID } from 'crypto'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[process-all-feeds] Starting feed processing for all topics`)

    const db = getSupabaseAdmin()

    // Get all unique topics
    const { data: topicRows, error: topicError } = await db
      .from('raw_items')
      .select('topic')
      .not('topic', 'is', null)

    if (topicError) {
      console.error(`[process-all-feeds] Error fetching topics:`, topicError)
      return NextResponse.json({ error: topicError.message }, { status: 500 })
    }

    const uniqueTopics = Array.from(new Set((topicRows || []).map((r: any) => r.topic).filter(Boolean)))
    console.log(`[process-all-feeds] Found ${uniqueTopics.length} unique topics:`, uniqueTopics)

    let totalProcessed = 0
    let totalGenerated = 0
    let totalSaved = 0
    const results: any[] = []

    for (const topic of uniqueTopics) {
      try {
        console.log(`[process-all-feeds] Processing topic: ${topic}`)

        // Fetch raw items for this topic
        const { data: rawItems, error: fetchError } = await db
          .from('raw_items')
          .select('url, title, content, image_url')
          .eq('topic', topic)
          .limit(20)
          .order('pub_date', { ascending: false })

        if (fetchError) {
          console.error(`[process-all-feeds] Fetch error for ${topic}:`, fetchError)
          results.push({ topic, status: 'error', error: fetchError.message })
          continue
        }

        if (!rawItems || rawItems.length === 0) {
          console.log(`[process-all-feeds] No raw items for ${topic}`)
          results.push({ topic, status: 'skipped', reason: 'no_items' })
          continue
        }

        totalProcessed += rawItems.length

        // Convert to format expected by processRawBatch
        const sourceResults = rawItems.map(item => ({
          url: item.url,
          title: item.title,
          content: item.content || '',
          image: item.image_url
        }))

        // Process through Gemini
        const newsItems = await processRawBatch(
          topic,
          sourceResults,
          [], // No existing titles for now
          (stats) => {
            console.log(`[process-all-feeds] Gemini stats for ${topic}:`, stats)
          }
        )

        totalGenerated += newsItems.length

        // Save to articles
        if (newsItems.length > 0) {
          const { error: saveError } = await db
            .from('articles')
            .upsert(
              newsItems.map(item => ({
                id: item.id,
                topic: item.topic,
                title: item.title,
                summary: item.summary,
                sections: item.sections,
                conclusion: item.conclusion,
                sources: item.sources,
                image_url: item.imageUrl,
                published_at: item.publishedAt,
                cached_at: item.cachedAt,
              })),
              { onConflict: 'id' }
            )

          if (saveError) {
            console.error(`[process-all-feeds] Save error for ${topic}:`, saveError)
            results.push({ topic, status: 'error', error: saveError.message, generated: newsItems.length })
          } else {
            totalSaved += newsItems.length
            results.push({ topic, status: 'success', itemsProcessed: rawItems.length, itemsGenerated: newsItems.length, itemsSaved: newsItems.length })
          }
        } else {
          results.push({ topic, status: 'no_output', itemsProcessed: rawItems.length })
        }

      } catch (err: any) {
        console.error(`[process-all-feeds] Error processing ${topic}:`, err.message)
        results.push({ topic, status: 'error', error: err.message })
      }
    }

    console.log(`[process-all-feeds] Complete. Processed: ${totalProcessed}, Generated: ${totalGenerated}, Saved: ${totalSaved}`)

    return NextResponse.json({
      status: 'complete',
      topicsProcessed: uniqueTopics.length,
      itemsProcessed: totalProcessed,
      newsGenerated: totalGenerated,
      newsSaved: totalSaved,
      results
    })

  } catch (err: any) {
    console.error('[process-all-feeds] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
