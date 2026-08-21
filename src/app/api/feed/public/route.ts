import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { DEFAULT_INTEREST_TOPICS, getInterestTopicFilters } from '@/lib/default-interest-topics'
import { PERSONALIZED_FEED_SELECT, toFeedItem } from '@/lib/feed-item'
import { isLikelyStaleLaunchArticle } from '@/lib/news-preprocessing'
import { FEED_PAGE_QUERY_SIZE, FEED_PAGE_SIZE } from '@/lib/feed-pagination-config'

export const dynamic = 'force-dynamic'

type PublicCursor = { offset: number; snapshotAt: string; topic: string | null }

function encodeCursor(cursor: PublicCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(value: unknown): PublicCursor | null {
  if (typeof value !== 'string' || value.length > 2_000) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<PublicCursor>
    if (!Number.isInteger(parsed.offset) || (parsed.offset ?? -1) < 0 || (parsed.offset ?? 0) > 50_000) return null
    if (typeof parsed.snapshotAt !== 'string' || Number.isNaN(Date.parse(parsed.snapshotAt))) return null
    if (typeof parsed.topic !== 'string' && parsed.topic !== null) return null
    return parsed as PublicCursor
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const requestedTopic = Array.isArray(body.topics) && typeof body.topics[0] === 'string'
    ? body.topics[0].trim() || null
    : null
  const cursor = body.cursor == null ? null : decodeCursor(body.cursor)
  if (body.cursor != null && !cursor) return NextResponse.json({ error: 'Invalid feed cursor' }, { status: 400 })
  if (cursor && cursor.topic !== requestedTopic) return NextResponse.json({ error: 'Feed cursor does not match topic' }, { status: 400 })

  const snapshotAt = cursor?.snapshotAt ?? new Date().toISOString()
  const offset = cursor?.offset ?? 0
  let query = getSupabaseAdmin()
    .from('articles')
    .select(PERSONALIZED_FEED_SELECT)
    .lte('published_at', snapshotAt)
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + FEED_PAGE_QUERY_SIZE - 1)

  if (requestedTopic) {
    const { articleTopics } = getInterestTopicFilters([requestedTopic])
    query = articleTopics.length > 0 ? query.in('topic', articleTopics) : query.eq('topic', requestedTopic)
  }

  const { data, error } = await query
  if (error) {
    console.error('[feed/public] articles failed:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o feed.' }, { status: 500 })
  }

  const rows = data ?? []
  const items = rows
    .slice(0, FEED_PAGE_SIZE)
    .map((row: any) => toFeedItem(row, requestedTopic ? [requestedTopic] : []))
    .filter((item) => !isLikelyStaleLaunchArticle({
      title: item.title,
      description: item.summary,
      sourceName: item.sources?.[0]?.name || '',
      topic: item.topic,
    }))
  const hasMore = rows.length > FEED_PAGE_SIZE

  return NextResponse.json({
    topics: DEFAULT_INTEREST_TOPICS,
    items,
    hasMore,
    nextCursor: hasMore ? encodeCursor({ offset: offset + FEED_PAGE_SIZE, snapshotAt, topic: requestedTopic }) : null,
  })
}
