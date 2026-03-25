import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/favorites/articles — full article data for user's favorites
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()

  // Fetch favorite article IDs
  const { data: favs, error: favError } = await db
    .from('user_favorites')
    .select('article_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (favError) return NextResponse.json({ error: favError.message }, { status: 500 })
  if (!favs?.length) return NextResponse.json({ items: [] })

  const ids = favs.map((f: any) => f.article_id)

  const { data: rows, error } = await db
    .from('articles')
    .select('id, topic, title, summary, sections, image_url, video_url, published_at, cached_at, sources, matched_topics')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort by favorite order (most recently favorited first)
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
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
    sources: row.sources,
    matchedTopics: row.matched_topics,
  }))

  return NextResponse.json({ items })
}
