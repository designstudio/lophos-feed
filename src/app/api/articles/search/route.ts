import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query required', items: [], totalResults: 0 }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const searchQuery = `%${q}%`

  const { data: rows, error, count } = await db
    .from('articles')
    .select('*', { count: 'exact' })
    .or(`title.ilike.${searchQuery},summary.ilike.${searchQuery}`)
    .order('cached_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[articles/search] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items: NewsItem[] = (rows || []).map(row => ({
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    sections: row.sections || [],
    conclusion: row.conclusion || undefined,
    sources: row.sources,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
    matchedTopics: row.matched_topics,
  }))

  return NextResponse.json({
    items,
    totalResults: count || 0,
    query: q,
  })
}
