import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'
import { getInterestTopicFilters } from '@/lib/default-interest-topics'
import { expandMatchedTopicCatalogFilters } from '@/lib/matched-topic-catalog'

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
  const topicFilters = getInterestTopicFilters(userTopics)
  const expandedMatchedTopics = await expandMatchedTopicCatalogFilters(db, topicFilters.matchedTopics)

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
  const buildSearchQuery = () => db
    .from('articles')
    .select('*')
    .or(`title.ilike.${searchQuery},summary.ilike.${searchQuery}`)
    .order('cached_at', { ascending: false })
    .limit(fetchLimit)

  const queries = [
    ...(expandedMatchedTopics.length > 0
      ? [buildSearchQuery().overlaps('matched_topics', expandedMatchedTopics)]
      : []),
    ...(topicFilters.articleTopics.length > 0
      ? [buildSearchQuery().in('topic', topicFilters.articleTopics)]
      : []),
  ]
  const results = await Promise.all(queries)

  const queryError = results.find((result) => result.error)?.error
  if (queryError) {
    console.error('[articles/search] Error:', queryError)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const rowsById = new Map(
    results.flatMap((result) => result.data ?? [])
      .map((row: any) => [row.id, row] as const),
  )
  const visibleRows = [...rowsById.values()]
    .filter(row => !hiddenIds.has(row.id))
    .sort((left, right) => new Date(right.cached_at).getTime() - new Date(left.cached_at).getTime())
    .slice(0, limit)

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
    totalResults: visibleRows.length,
    query: q,
  })
}
