import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  const q = req.nextUrl.searchParams.get('q')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const topicsParam = req.nextUrl.searchParams.get('topics')

  if (!userId) {
    return NextResponse.json({ items: [], totalResults: 0, query: q ?? '' }, { status: 401 })
  }

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

  const { data: hiddenRows, error: hiddenError } = await db
    .from('user_reactions')
    .select('article_id')
    .eq('user_id', userId)
    .eq('reaction', 'dislike')

  if (hiddenError) {
    console.error('[articles/search] Hidden reactions error:', hiddenError)
    return NextResponse.json({ error: hiddenError.message }, { status: 500 })
  }

  const hiddenIds = new Set((hiddenRows ?? []).map((row: any) => row.article_id))
  const fetchLimit = Math.min(limit + hiddenIds.size, 60)

  // Filtra por texto E por interseção com os tópicos do usuário (matched_topics overlap)
  const { data: rows, error, count } = await db
    .from('articles')
    .select('*', { count: 'exact' })
    .or(`title.ilike.${searchQuery},summary.ilike.${searchQuery}`)
    .filter('matched_topics', 'ov', `{${userTopics.join(',')}}`)
    .order('cached_at', { ascending: false })
    .limit(fetchLimit)

  if (error) {
    console.error('[articles/search] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const visibleRows = (rows || []).filter(row => !hiddenIds.has(row.id)).slice(0, limit)

  const items: NewsItem[] = visibleRows.map(row => ({
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
    totalResults: Math.min(count ?? items.length, visibleRows.length),
    query: q,
  })
}
