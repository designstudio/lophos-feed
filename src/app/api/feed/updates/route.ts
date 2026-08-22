import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { toFeedItem } from '@/lib/feed-item'
import { loadBlockedTopics } from '@/lib/topic-signals'
import { getInterestTopicFilters } from '@/lib/default-interest-topics'
import { expandMatchedTopicCatalogFilters } from '@/lib/matched-topic-catalog'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const since: string = body.since // ISO timestamp of newest article in current feed
  const topics: string[] = body.topics ?? []

  if (!since || topics.length === 0)
    return NextResponse.json({ hasUpdates: false })

  const db = getSupabaseAdmin()
  const topicFilters = getInterestTopicFilters(topics)
  const expandedMatchedTopics = await expandMatchedTopicCatalogFilters(db, topicFilters.matchedTopics)
  const blockedTopics = await loadBlockedTopics(
    db,
    userId,
    [...topicFilters.articleTopics, ...expandedMatchedTopics],
  )
  const blockedSet = new Set(await expandMatchedTopicCatalogFilters(db, blockedTopics))

  // Check if there are articles newer than `since` matching user's topics
  const buildUpdatesQuery = () => db
    .from('articles')
    .select('id, title, topic, summary, sources, image_url, published_at, cached_at, matched_topics')
    .gt('cached_at', since)
    .order('cached_at', { ascending: false })
    .limit(50)

  const queries = [
    ...(expandedMatchedTopics.length > 0
      ? [buildUpdatesQuery().overlaps('matched_topics', expandedMatchedTopics)]
      : []),
    ...(topicFilters.articleTopics.length > 0
      ? [buildUpdatesQuery().in('topic', topicFilters.articleTopics)]
      : []),
  ]
  const results = await Promise.all(queries)

  if (results.some((result) => result.error)) return NextResponse.json({ hasUpdates: false })

  const rowsById = new Map(
    results.flatMap((result) => result.data ?? [])
      .map((row: any) => [row.id, row] as const),
  )
  const visibleRows = [...rowsById.values()].filter((row: any) => {
    const matchedTopics = Array.isArray(row.matched_topics) ? row.matched_topics : []
    return !matchedTopics.some((topic: string) => blockedSet.has(String(topic).toLowerCase().trim()))
  }).sort((left: any, right: any) => new Date(right.cached_at).getTime() - new Date(left.cached_at).getTime())

  return NextResponse.json({
    hasUpdates: visibleRows.length > 0,
    items: visibleRows.map((row: any) => toFeedItem(row, topics)),
  })
}
