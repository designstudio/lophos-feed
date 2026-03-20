import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // 1. Try cache first (article might still be fresh)
  const { data: cached } = await db
    .from('news_cache')
    .select('*')
    .eq('id', id)
    .single()

  const row = cached ?? await (async () => {
    // 2. Fallback to permanent articles table (user opened this before)
    const { data } = await db.from('articles').select('*').eq('id', id).single()
    return data
  })()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 3. Persist to articles table so it survives cache clears
  await db.from('articles').upsert({
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    sources: row.sources,
    image_url: row.image_url,
    published_at: row.published_at,
    cached_at: row.cached_at,
  }, { onConflict: 'id' })

  return NextResponse.json({
    item: {
      id: row.id,
      topic: row.topic,
      title: row.title,
      summary: row.summary,
      sections: row.sections || [],
      conclusion: row.conclusion || undefined,
      sources: row.sources,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
      cachedAt: row.cached_at,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const db = getSupabaseAdmin()

  // Load article to get sources
  const { data: row } = await db
    .from('news_cache')
    .select('id, sources, image_url')
    .eq('id', id)
    .single()
    .then(r => r.data ? r : db.from('articles').select('id, sources, image_url').eq('id', id).single())

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-fetch image using the same cascade as news.ts
  const { fetchImageForSources } = await import('@/lib/news')
  const imageUrl = await fetchImageForSources(row.sources || [])

  if (!imageUrl) return NextResponse.json({ error: 'No image found' }, { status: 404 })

  // Update both tables
  await Promise.all([
    db.from('news_cache').update({ image_url: imageUrl }).eq('id', id),
    db.from('articles').update({ image_url: imageUrl }).eq('id', id),
  ])

  return NextResponse.json({ imageUrl })
}
