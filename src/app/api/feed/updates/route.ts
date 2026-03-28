import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

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

  // Check if there are articles newer than `since` matching user's topics
  const { data, error } = await db
    .from('articles')
    .select('id, title, topic, summary, sections, conclusion, sources, image_url, video_url, published_at, cached_at, matched_topics, tavily_raw')
    .or(topics.map((t: string) => `matched_topics.cs.{${t}}`).join(','))
    .gt('cached_at', since)
    .order('cached_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ hasUpdates: false })

  return NextResponse.json({
    hasUpdates: (data?.length ?? 0) > 0,
    items: data ?? [],
  })
}
