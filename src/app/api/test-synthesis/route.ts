import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { processRawBatch } from '@/lib/news'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const topic = req.nextUrl.searchParams.get('topic')
    if (!topic) {
      return NextResponse.json({ error: 'Missing topic parameter' }, { status: 400 })
    }

    console.log(`[test-synthesis] Starting test for topic: ${topic}`)

    const db = getSupabaseAdmin()

    // Fetch raw items for this topic
    const { data: rawItems, error: fetchError } = await db
      .from('raw_items')
      .select('url, title, content, image_url')
      .eq('topic', topic)
      .limit(15)
      .order('pub_date', { ascending: false })

    if (fetchError) {
      console.error(`[test-synthesis] Fetch error:`, fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!rawItems || rawItems.length === 0) {
      return NextResponse.json({
        topic,
        message: 'No raw items found for this topic',
        itemsCount: 0,
        newsItems: []
      })
    }

    console.log(`[test-synthesis] Found ${rawItems.length} raw items for topic: ${topic}`)

    // Convert to format expected by processRawBatch
    const results = rawItems.map(item => ({
      url: item.url,
      title: item.title,
      content: item.content || '',
      image: item.image_url
    }))

    // Process through Gemini
    const newsItems = await processRawBatch(
      topic,
      results,
      [], // No existing titles for test
      (stats) => {
        console.log(`[test-synthesis] Gemini stats:`, stats)
      }
    )

    console.log(`[test-synthesis] Generated ${newsItems.length} news items`)

    return NextResponse.json({
      topic,
      itemsProcessed: rawItems.length,
      newsGenerated: newsItems.length,
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
    console.error('[test-synthesis] Error:', err.message)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
