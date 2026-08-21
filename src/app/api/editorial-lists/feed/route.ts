import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getInterestTopicFilters } from '@/lib/default-interest-topics'
import { EDITORIAL_LIST_CARD_SELECT, toEditorialListCardItem } from '@/lib/editorial-list-card'

export const dynamic = 'force-dynamic'

function normalize(value: string) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  const db = getSupabaseAdmin()
  const explicitTopic = request.nextUrl.searchParams.get('topic')?.trim()
  if (!userId && !explicitTopic) {
    const { data, error } = await db
      .from('editorial_lists')
      .select(EDITORIAL_LIST_CARD_SELECT)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(8)
    if (error) {
      console.error('[editorial-lists/feed] public lists failed:', error)
      return NextResponse.json({ error: 'Failed to load editorial lists' }, { status: 500 })
    }
    return NextResponse.json({ items: (data ?? []).map(toEditorialListCardItem), reactions: {} })
  }

  const [{ data: topicRows, error: topicsError }, { data: reactionRows, error: reactionsError }] = await Promise.all([
    explicitTopic
      ? Promise.resolve({ data: [{ topic: explicitTopic }], error: null })
      : db.from('user_topics').select('topic').eq('user_id', userId),
    userId
      ? db.from('editorial_list_reactions').select('list_id, reaction').eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (topicsError || reactionsError) {
    console.error('[editorial-lists/feed] preferences failed:', topicsError || reactionsError)
    return NextResponse.json({ error: 'Failed to load list preferences' }, { status: 500 })
  }

  const selectedTopics = (topicRows ?? []).map((row: any) => row.topic).filter(Boolean)
  if (selectedTopics.length === 0) return NextResponse.json({ items: [], reactions: {} })

  const { articleTopics, matchedTopics } = getInterestTopicFilters(selectedTopics)
  const primary = new Set(articleTopics.map(normalize))
  const related = new Set([...matchedTopics, ...selectedTopics].map(normalize))
  const reactions = Object.fromEntries((reactionRows ?? []).map((row: any) => [row.list_id, row.reaction]))

  const { data, error } = await db
    .from('editorial_lists')
    .select(EDITORIAL_LIST_CARD_SELECT)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(40)

  if (error) {
    console.error('[editorial-lists/feed] lists failed:', error)
    return NextResponse.json({ error: 'Failed to load editorial lists' }, { status: 500 })
  }

  const now = Date.now()
  const ranked = (data ?? []).flatMap((row: any) => {
    if (reactions[row.id] === 'dislike') return []
    const topicMatch = primary.has(normalize(row.topic)) || related.has(normalize(row.topic))
    const relatedMatches = (Array.isArray(row.matched_topics) ? row.matched_topics : [])
      .filter((topic: string) => related.has(normalize(topic))).length
    if (!topicMatch && relatedMatches === 0) return []
    const ageDays = Math.max(0, (now - new Date(row.published_at).getTime()) / 86_400_000)
    return [{ row, score: (topicMatch ? 8 : 0) + relatedMatches * 3 + Math.max(0, 4 - ageDays / 30) }]
  }).sort((first, second) => second.score - first.score)

  return NextResponse.json({
    items: ranked.slice(0, 8).map(({ row }) => toEditorialListCardItem(row)),
    reactions,
  })
}
