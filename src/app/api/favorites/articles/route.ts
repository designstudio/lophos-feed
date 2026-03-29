import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/favorites/articles — artigos curtidos (reaction = 'like') pelo usuário
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()

  // Busca IDs dos artigos curtidos (like) mais recentes
  const { data: liked, error: likedError } = await db
    .from('user_reactions')
    .select('article_id, created_at')
    .eq('user_id', userId)
    .eq('reaction', 'like')
    .order('created_at', { ascending: false })

  if (likedError) return NextResponse.json({ error: likedError.message }, { status: 500 })
  if (!liked?.length) return NextResponse.json({ items: [] })

  const ids = liked.map((r: any) => r.article_id)

  const { data: rows, error } = await db
    .from('articles')
    .select('id, topic, title, summary, sections, image_url, video_url, published_at, cached_at, sources, matched_topics')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mantém ordem por mais recentemente curtido
  const ordered = ids
    .map((id: string) => (rows || []).find((r: any) => r.id === id))
    .filter(Boolean)

  const items = ordered.map((row: any) => ({
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    sections: row.sections || [],
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
    sources: row.sources,
    matchedTopics: row.matched_topics,
  }))

  return NextResponse.json({ items })
}
