import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processRawBatch } from '@/lib/news'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (secret !== process.env.RSS_INGEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const topic = url.searchParams.get('topic')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    console.log(`[process-all-news-cache] Processing articles${topic ? ` for topic: ${topic}` : ''}, limit=${limit}, offset=${offset}`)

    // Get items from articles
    let query = db.from('articles').select('*')

    if (topic) {
      query = query.eq('topic', topic)
    }

    const { data: newsItems, error: fetchError } = await query
      .range(offset, offset + limit - 1)
      .order('cached_at', { ascending: false })

    if (fetchError) {
      console.error('[process-all-news-cache] Database error:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!newsItems || newsItems.length === 0) {
      console.log('[process-all-news-cache] No items to process')
      return NextResponse.json({
        status: 'complete',
        itemsProcessed: 0,
        newsGenerated: 0,
        newsSaved: 0,
      })
    }

    console.log(`[process-all-news-cache] Found ${newsItems.length} items to process`)

    // Group by topic for processing
    const itemsByTopic = new Map<string, any[]>()
    for (const item of newsItems) {
      if (!itemsByTopic.has(item.topic)) {
        itemsByTopic.set(item.topic, [])
      }
      itemsByTopic.get(item.topic)!.push(item)
    }

    let totalGenerated = 0
    let totalSaved = 0

    // Process each topic
    for (const [currentTopic, items] of itemsByTopic) {
      console.log(`[process-all-news-cache] Processing ${currentTopic}: ${items.length} items`)

      // Format items as sources for Gemini
      const results = items.map((item) => ({
        url: item.source_url,
        title: item.title,
        content: item.content || item.summary,
        image: item.image_url,
      }))

      // Process with Gemini for deduplication
      const newsData = await processRawBatch(currentTopic, results)

      if (newsData && newsData.length > 0) {
        console.log(`[process-all-news-cache] ${currentTopic}: Generated ${newsData.length} deduplicated news`)

        // Save to articles
        const { error: insertError } = await db.from('articles').insert(
          newsData.map(news => ({
            topic: currentTopic,
            title: news.title,
            summary: news.summary,
            sections: news.sections,
            conclusion: news.conclusion,
            sources: news.sources,
            image_url: news.imageUrl,
            published_at: new Date().toISOString(),
          }))
        )

        if (insertError) {
          console.error(`[process-all-news-cache] Error saving to articles:`, insertError)
        } else {
          totalSaved += newsData.length
          totalGenerated += newsData.length
        }
      }
    }

    console.log(`[process-all-news-cache] Complete: generated=${totalGenerated}, saved=${totalSaved}`)

    return NextResponse.json({
      status: 'complete',
      itemsProcessed: newsItems.length,
      newsGenerated: totalGenerated,
      newsSaved: totalSaved,
    })
  } catch (err: any) {
    console.error('[process-all-news-cache] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
