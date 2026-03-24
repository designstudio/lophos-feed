import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // Fetch the current article to get its matched_topics
  const { data: current } = await db
    .from('articles')
    .select('matched_topics')
    .eq('id', id)
    .single()

  if (!current?.matched_topics?.length) {
    return NextResponse.json({ items: [] })
  }

  // Build OR filter: any article that contains at least one of the same keywords
  const orFilter = current.matched_topics
    .map((t: string) => `matched_topics.cs.{${t}}`)
    .join(',')

  const { data: rows } = await db
    .from('articles')
    .select('id, topic, title, summary, image_url, published_at, matched_topics')
    .or(orFilter)
    .neq('id', id)
    .order('published_at', { ascending: false })
    .limit(6)

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
