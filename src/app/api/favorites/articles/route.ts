import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/favorites/articles — artigos curtidos (reaction = 'like') pelo usuário
const PAGE_SIZE = 10

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  const requestedOffset = Number(request.nextUrl.searchParams.get('offset') || 0)
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0
    ? Math.floor(requestedOffset)
    : 0

  // Carrega somente uma página de IDs, mantendo os likes mais recentes primeiro.
  const { data: liked, error: likedError } = await db
    .from('user_reactions')
    .select('article_id, created_at')
    .eq('user_id', userId)
    .eq('reaction', 'like')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE)

  if (likedError) return NextResponse.json({ error: likedError.message }, { status: 500 })
  if (!liked?.length) return NextResponse.json({ items: [], hasMore: false, nextOffset: null })

  const page = liked.slice(0, PAGE_SIZE)
  const ids = page.map((r: any) => r.article_id)

  const { data: rows, error } = await db
    .from('articles')
    .select('id, topic, title, summary, image_url, published_at, cached_at, sources')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mantém a ordem dos likes sem fazer uma busca linear para cada artigo.
  const rowsById = new Map((rows || []).map((row: any) => [row.id, row]))
  const ordered = ids
    .map((id: string) => rowsById.get(id))
    .filter(Boolean)

  const items = ordered.map((row: any) => ({
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
    sources: row.sources,
  }))

  const nextOffset = offset + page.length
  const hasMore = liked.length > PAGE_SIZE
  return NextResponse.json({ items, hasMore, nextOffset: hasMore ? nextOffset : null })
}
