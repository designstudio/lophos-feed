import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  const { data: row } = await db.from('news_cache').select('*').eq('id', id).single()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    item: {
      id: row.id, topic: row.topic, title: row.title, summary: row.summary,
      sections: row.sections || [], conclusion: row.conclusion || undefined,
      sources: row.sources, imageUrl: row.image_url,
      publishedAt: row.published_at, cachedAt: row.cached_at,
    },
  })
}
