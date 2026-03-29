import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const topicsParam = req.nextUrl.searchParams.get('topics')

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query required', items: [], totalResults: 0 }, { status: 400 })
  }

  // Guarda: sem tópicos do usuário, não retorna nada
  const userTopics = topicsParam ? topicsParam.split(',').map(t => t.trim()).filter(Boolean) : []
  if (userTopics.length === 0) {
    return NextResponse.json({ items: [], totalResults: 0, query: q })
  }

  const db = getSupabaseAdmin()
  const searchQuery = `%${q}%`

  // Filtra por texto E por interseção com os tópicos do usuário (matched_topics overlap)
  const { data: rows, error, count } = await db
    .from('articles')
    .select('*', { count: 'exact' })
    .or(`title.ilike.${searchQuery},summary.ilike.${searchQuery}`)
    .filter('matched_topics', 'ov', `{${userTopics.join(',')}}`)
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
