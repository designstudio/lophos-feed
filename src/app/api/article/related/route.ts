import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ items: [] })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // Fetch user's topics and current article in parallel
  const [{ data: current }, { data: userTopicsRows }] = await Promise.all([
    db.from('articles').select('matched_topics').eq('id', id).single(),
    db.from('user_topics').select('topic').eq('user_id', userId),
  ])

  const userTopics: string[] = (userTopicsRows ?? []).map((r: any) => r.topic)

  if (!current?.matched_topics?.length || userTopics.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // Intersect article's matched_topics with user's feed topics so related
  // articles come only from the user's areas of interest
  const intersection = current.matched_topics.filter((t: string) =>
    userTopics.includes(t)
  )

  // Fall back to user's topics if the article has no overlap (e.g. shared link)
  const filterTopics = intersection.length > 0 ? intersection : userTopics

  const orFilter = filterTopics
    .map((t: string) => `matched_topics.cs.{${t}}`)
    .join(',')

  const { data: rows } = await db
    .from('articles')
    .select('id, topic, title, summary, image_url, video_url, published_at, matched_topics')
    .or(orFilter)
    .neq('id', id)
    .order('published_at', { ascending: false })
    .limit(4)

  const items = (rows || []).map((row: any) => ({
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
  }))

  return NextResponse.json({ items })
}
