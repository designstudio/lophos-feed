import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { loadBlockedTopics } from '@/lib/topic-signals'
import {
  getInterestTopicFilters,
  getMatchingInterestTopicLabel,
  toInterestTopicLabels,
} from '@/lib/default-interest-topics'

function normalizeTopic(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeTopics(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(normalizeTopic).filter(Boolean))]
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ items: [] })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // Fetch current article, user topics, and hidden articles in parallel
  const [{ data: current }, { data: userTopicsRows }, { data: hiddenRows }] = await Promise.all([
    db.from('articles').select('topic, matched_topics').eq('id', id).single(),
    db.from('user_topics').select('topic').eq('user_id', userId),
    db.from('user_reactions').select('article_id').eq('user_id', userId).eq('reaction', 'dislike'),
  ])

  const selectedTopics = toInterestTopicLabels((userTopicsRows ?? []).map((row: any) => row.topic))
  const topicFilters = getInterestTopicFilters(selectedTopics)
  const currentMatchedTopics = normalizeTopics(current?.matched_topics)
  const currentTopics = normalizeTopics([current?.topic, ...currentMatchedTopics])
  const currentInterestTopic = getMatchingInterestTopicLabel(
    String(current?.topic ?? ''),
    currentMatchedTopics,
    selectedTopics,
  )
  const hiddenIds = new Set((hiddenRows ?? []).map((r: any) => r.article_id))
  const blockedTopics = new Set(await loadBlockedTopics(
    db,
    userId,
    [...topicFilters.articleTopics, ...topicFilters.matchedTopics],
  ))

  if (currentTopics.length === 0 || selectedTopics.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // First collect articles that overlap any matched topic from the current
  // article. The user's topics remain an eligibility boundary below, but do
  // not replace the article's more specific similarity signals.
  const buildRelatedQuery = () => db
    .from('articles')
    .select('id, topic, title, summary, image_url, video_url, published_at, matched_topics')
    .neq('id', id)
    .order('published_at', { ascending: false })
    .limit(60)

  const [matchedResult, primaryResult] = await Promise.all([
    buildRelatedQuery().overlaps('matched_topics', currentTopics),
    buildRelatedQuery().in('topic', currentTopics),
  ])
  const queryError = matchedResult.error ?? primaryResult.error

  if (queryError) {
    console.error('[related] Failed to load candidates:', queryError)
    return NextResponse.json({ items: [] })
  }

  const rows = [...new Map(
    [...(matchedResult.data ?? []), ...(primaryResult.data ?? [])]
      .map((row: any) => [row.id, row] as const),
  ).values()]

  const items = rows
    .filter((row: any) => !hiddenIds.has(row.id))
    .map((row: any) => {
      const candidateMatchedTopics = normalizeTopics(row.matched_topics)
      const candidateTopics = normalizeTopics([row.topic, ...candidateMatchedTopics])
      const candidateTopicSet = new Set(candidateTopics)
      const sharedTopics = currentTopics.filter((topic) => candidateTopicSet.has(topic))
      const candidateInterestTopic = getMatchingInterestTopicLabel(
        String(row.topic ?? ''),
        candidateMatchedTopics,
        selectedTopics,
      )
      const sharedInterestTopics = currentInterestTopic && candidateInterestTopic === currentInterestTopic
        ? [currentInterestTopic]
        : []

      return {
        row,
        candidateTopics,
        candidateInterestTopic,
        sharedTopics,
        sharedInterestTopics,
        similarity: sharedTopics.length / Math.sqrt(currentTopics.length * candidateTopics.length),
      }
    })
    .filter(({ candidateTopics, candidateInterestTopic, sharedTopics }) => {
      if (sharedTopics.length === 0) return false
      if (currentInterestTopic && !candidateInterestTopic) return false
      return !candidateTopics.some((topic) => blockedTopics.has(topic))
    })
    .sort((a, b) => {
      const aSpecificMatches = a.sharedTopics.length - a.sharedInterestTopics.length
      const bSpecificMatches = b.sharedTopics.length - b.sharedInterestTopics.length

      return bSpecificMatches - aSpecificMatches
        || b.sharedTopics.length - a.sharedTopics.length
        || b.similarity - a.similarity
        || new Date(b.row.published_at).getTime() - new Date(a.row.published_at).getTime()
    })
    .slice(0, 4)
    .map(({ row }) => ({
      id: row.id,
      topic: row.topic,
      title: row.title,
      summary: row.summary,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
    }))

  return NextResponse.json({ items })
}
