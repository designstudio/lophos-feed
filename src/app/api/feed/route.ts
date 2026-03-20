import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic, isCacheStale } from '@/lib/news'
import { NewsItem } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, forceRefresh = false } = await req.json()
  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ error: 'Topics required' }, { status: 400 })
  }

  const allItems: NewsItem[] = []
  const db = getSupabaseAdmin()

  await Promise.allSettled(
    topics.map(async (topic: string) => {
      if (!forceRefresh) {
        const { data: cached } = await db
          .from('news_cache')
          .select('*')
          .eq('topic', topic)
          .order('cached_at', { ascending: false })
          .limit(2)

        if (cached && cached.length > 0 && !isCacheStale(cached[0].cached_at)) {
          allItems.push(...cached.map((row: any) => ({
            id: row.id,
            topic: row.topic,
            title: row.title,
            summary: row.summary,
            sources: row.sources,
            imageUrl: row.image_url,
            publishedAt: row.published_at,
            cachedAt: row.cached_at,
          })))
          return
        }
      }

      try {
        const fresh = await fetchNewsForTopic(topic)
        if (fresh.length === 0) return

        await db.from('news_cache').delete().eq('topic', topic)

        const rows = fresh.map((item) => ({
          topic: item.topic,
          title: item.title,
          summary: item.summary,
          sources: item.sources,
          image_url: item.imageUrl || null,
          published_at: item.publishedAt,
          cached_at: item.cachedAt,
        }))

        const { data: inserted } = await db.from('news_cache').insert(rows).select()

        allItems.push(...(inserted || []).map((row: any) => ({
          id: row.id,
          topic: row.topic,
          title: row.title,
          summary: row.summary,
          sources: row.sources,
          imageUrl: row.image_url,
          publishedAt: row.published_at,
          cachedAt: row.cached_at,
        })))
      } catch (e) {
        console.error(`Error fetching topic "${topic}":`, e)
      }
    })
  )

  return NextResponse.json({ items: allItems })
}
