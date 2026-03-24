import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const db = getSupabaseAdmin()
    const url = new URL(req.url)
    const topic = url.searchParams.get('topic') || 'curiosidades'
    const limit = 100
    const offset = 0

    console.log(`[diagnostic] Querying news_cache for topic: ${topic}`)

    // Exact same query as process-all-news-cache
    let query = db.from('news_cache').select('*')

    if (topic) {
      query = query.eq('topic', topic)
    }

    const { data: newsItems, error: fetchError } = await query
      .range(offset, offset + limit - 1)
      .order('cached_at', { ascending: false })

    console.log(`[diagnostic] Query result:`, {
      error: fetchError?.message,
      itemsFound: newsItems?.length,
      firstItem: newsItems?.[0],
    })

    return NextResponse.json({
      topic,
      itemsFound: newsItems?.length || 0,
      error: fetchError?.message,
      firstItem: newsItems?.[0] || null,
      allItems: newsItems || [],
    })
  } catch (err: any) {
    console.error('[diagnostic] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Error' },
      { status: 500 }
    )
  }
}
