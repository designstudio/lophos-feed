import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { EDITORIAL_LIST_CARD_SELECT, toEditorialListCardItem } from '@/lib/editorial-list-card'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 10

type FavoriteSignal = { kind: 'article' | 'editorial-list'; id: string; likedAt: string }
type FavoritePayloadEntry =
  | { kind: 'article'; item: Record<string, any> }
  | { kind: 'editorial-list'; list: ReturnType<typeof toEditorialListCardItem> }

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  const requestedOffset = Number(request.nextUrl.searchParams.get('offset') || 0)
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.floor(requestedOffset) : 0
  const candidateEnd = offset + PAGE_SIZE
  const [{ data: articleLikes, error: articleLikesError }, { data: listLikes, error: listLikesError }] = await Promise.all([
    db.from('user_reactions').select('article_id, created_at').eq('user_id', userId).eq('reaction', 'like').order('created_at', { ascending: false }).range(0, candidateEnd),
    db.from('editorial_list_reactions').select('list_id, created_at').eq('user_id', userId).eq('reaction', 'like').order('created_at', { ascending: false }).range(0, candidateEnd),
  ])

  if (articleLikesError || listLikesError) {
    return NextResponse.json({ error: (articleLikesError || listLikesError)?.message }, { status: 500 })
  }

  const signals: FavoriteSignal[] = [
    ...(articleLikes ?? []).map((row: any) => ({ kind: 'article' as const, id: row.article_id, likedAt: row.created_at })),
    ...(listLikes ?? []).map((row: any) => ({ kind: 'editorial-list' as const, id: row.list_id, likedAt: row.created_at })),
  ].sort((first, second) => new Date(second.likedAt).getTime() - new Date(first.likedAt).getTime())
  const candidates = signals.slice(offset, offset + PAGE_SIZE + 1)
  const page = candidates.slice(0, PAGE_SIZE)
  if (page.length === 0) return NextResponse.json({ items: [], hasMore: false, nextOffset: null })

  const articleIds = page.filter((signal) => signal.kind === 'article').map((signal) => signal.id)
  const listIds = page.filter((signal) => signal.kind === 'editorial-list').map((signal) => signal.id)
  const [{ data: articles, error: articlesError }, { data: lists, error: listsError }] = await Promise.all([
    articleIds.length > 0
      ? db.from('articles').select('id, topic, title, summary, image_url, published_at, cached_at, sources').in('id', articleIds)
      : Promise.resolve({ data: [], error: null }),
    listIds.length > 0
      ? db.from('editorial_lists').select(EDITORIAL_LIST_CARD_SELECT).in('id', listIds).eq('status', 'published')
      : Promise.resolve({ data: [], error: null }),
  ])
  if (articlesError || listsError) {
    return NextResponse.json({ error: (articlesError || listsError)?.message }, { status: 500 })
  }

  const articlesById = new Map((articles ?? []).map((row: any) => [row.id, row]))
  const listsById = new Map((lists ?? []).map((row: any) => [row.id, row]))
  const items: FavoritePayloadEntry[] = []
  page.forEach((signal) => {
    if (signal.kind === 'editorial-list') {
      const row = listsById.get(signal.id)
      if (row) items.push({ kind: 'editorial-list', list: toEditorialListCardItem(row) })
      return
    }
    const row: any = articlesById.get(signal.id)
    if (row) items.push({ kind: 'article', item: {
      id: row.id, topic: row.topic, title: row.title, summary: row.summary,
      imageUrl: row.image_url, publishedAt: row.published_at, cachedAt: row.cached_at, sources: row.sources,
    } })
  })

  const hasMore = candidates.length > PAGE_SIZE
  return NextResponse.json({ items, hasMore, nextOffset: hasMore ? offset + page.length : null })
}
