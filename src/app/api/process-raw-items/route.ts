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

    console.log(`[process-raw-items] Starting synthesis of all unprocessed items`)

    const db = getSupabaseAdmin()

    // Fetch all unprocessed raw items
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')
    const { data: rawItems, error: fetchError } = await db
      .from('raw_items')
      .select('url, title, content, image_url, topic')
      .eq('processed', false)
      .limit(limit)
      .order('pub_date', { ascending: false })

    if (fetchError) {
      console.error(`[process-raw-items] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!rawItems || rawItems.length === 0) {
      console.log(`[process-raw-items] No unprocessed items found`)
      return NextResponse.json({
        status: 'complete',
        itemsProcessed: 0,
        newsGenerated: 0,
        newsSaved: 0,
        message: 'No unprocessed items found'
      })
    }

    console.log(`[process-raw-items] Found ${rawItems.length} unprocessed items`)

    // Convert to format expected by processRawBatch
    const sourceResults = rawItems.map(item => ({
      url: item.url,
      title: item.title,
      content: item.content || '',
      image: item.image_url
    }))

    // Determine primary topic for context (most common or first)
    const topicCounts: Record<string, number> = {}
    for (const item of rawItems) {
      topicCounts[item.topic || 'geral'] = (topicCounts[item.topic || 'geral'] || 0) + 1
    }
    const primaryTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0][0]

    console.log(`[process-raw-items] Primary topic: ${primaryTopic}`)

    // Process all items together through Gemini
    const newsItems = await processRawBatch(
      primaryTopic,
      sourceResults,
      [],
      (stats) => {
        console.log(`[process-raw-items] Gemini stats:`, stats)
      }
    )

    console.log(`[process-raw-items] Generated ${newsItems.length} news items`)

    // Save to articles
    let newsSaved = 0
    if (newsItems.length > 0) {
      const { error: saveError, data: savedData } = await db
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
            matched_topics: item.matchedTopics ?? [item.topic],
          })),
          { onConflict: 'id' }
        )

      if (saveError) {
        console.error(`[process-raw-items] Save error:`, saveError)
        return NextResponse.json({ error: saveError.message }, { status: 500 })
      }

      newsSaved = newsItems.length
    }

    // Mark items as processed
    const { error: updateError } = await db
      .from('raw_items')
      .update({ processed: true })
      .in('url', rawItems.map(r => r.url))

    if (updateError) {
      console.error(`[process-raw-items] Update error:`, updateError)
      // Don't fail, just log
    }

    console.log(`[process-raw-items] Complete. Processed: ${rawItems.length}, Generated: ${newsItems.length}, Saved: ${newsSaved}`)

    return NextResponse.json({
      status: 'complete',
      itemsProcessed: rawItems.length,
      newsGenerated: newsItems.length,
      newsSaved: newsSaved,
      newsItems: newsItems.map(item => ({
        title: item.title,
        summary: item.summary,
        sections: item.sections,
        conclusion: item.conclusion,
        sources: item.sources,
        imageUrl: item.imageUrl
      }))
    })

  } catch (err: any) {
    console.error('[process-raw-items] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
