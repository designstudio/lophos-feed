import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  const { data: row } = await db.from('articles').select('*').eq('id', id).single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    item: {
      id: row.id, topic: row.topic, title: row.title, summary: row.summary,
      sections: row.sections || [], conclusion: row.conclusion || undefined,
      sources: row.sources, imageUrl: row.image_url, videoUrl: row.video_url,
      publishedAt: row.published_at, cachedAt: row.cached_at,
    },
  })
}
