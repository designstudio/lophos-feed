import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processRawBatch } from '@/lib/news'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const ingestSecret = process.env.RSS_INGEST_SECRET
    const topic = req.nextUrl.searchParams.get('topic')

    if (!ingestSecret || !authHeader.includes(ingestSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!topic) {
      return NextResponse.json({ error: 'Missing topic parameter' }, { status: 400 })
    }

    console.log(`[process-topic] Processing topic: ${topic}`)

    const db = getSupabaseAdmin()

    // Fetch unprocessed items for this topic
    const { data: rawItems, error: fetchError } = await db
      .from('raw_items')
      .select('url, title, content, image_url, topic')
      .eq('topic', topic)
      .eq('processed', false)
      .order('pub_date', { ascending: false })

    if (fetchError) {
      console.error(`[process-topic] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!rawItems || rawItems.length === 0) {
      console.log(`[process-topic] No unprocessed items for topic: ${topic}`)
      return NextResponse.json({
        status: 'complete',
        topic,
        itemsProcessed: 0,
        newsGenerated: 0,
        newsSaved: 0,
        message: `No unprocessed items for topic: ${topic}`
      })
    }

    console.log(`[process-topic] Found ${rawItems.length} unprocessed items for ${topic}`)

    // Convert to format expected by processRawBatch
    const sourceResults = rawItems.map(item => ({
      url: item.url,
      title: item.title,
      content: item.content || '',
      image: item.image_url
    }))

    // Process items for this topic through Gemini
    const newsItems = await processRawBatch(
      topic,
      sourceResults,
      [],
      (stats) => {
        console.log(`[process-topic] Gemini stats for ${topic}:`, stats)
      }
    )

    console.log(`[process-topic] Generated ${newsItems.length} news items for ${topic}`)

    // Save to news_cache
    let newsSaved = 0
    if (newsItems.length > 0) {
      const { error: saveError } = await db
        .from('news_cache')
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
        console.error(`[process-topic] Save error:`, saveError)
        return NextResponse.json({ error: saveError.message }, { status: 500 })
      }

      newsSaved = newsItems.length
    }

    // Mark items as processed
    const { error: updateError } = await db
      .from('raw_items')
      .update({ processed: true })
      .eq('topic', topic)
      .eq('processed', false)

    if (updateError) {
      console.error(`[process-topic] Update error:`, updateError)
    }

    console.log(`[process-topic] Complete for ${topic}. Processed: ${rawItems.length}, Generated: ${newsItems.length}, Saved: ${newsSaved}`)

    return NextResponse.json({
      status: 'complete',
      topic,
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
    console.error('[process-topic] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
