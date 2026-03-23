import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const db = getSupabaseAdmin()

  try {
    // Get user topics
    const { data: userTopics } = await db
      .from('user_topics')
      .select('topic')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    const topics = (userTopics ?? []).map(r => r.topic)

    // Get article count per topic (last 48 hours)
    const cutoffIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

    const { data: articles } = await db
      .from('news_cache')
      .select('topic, published_at, cached_at, image_url')
      .in('topic', topics)
      .gte('cached_at', cutoffIso)
      .order('cached_at', { ascending: false })

    // Count by topic
    const stats = new Map<string, { count: number; withImage: number; oldest: string; newest: string }>()

    for (const topic of topics) {
      stats.set(topic, { count: 0, withImage: 0, oldest: '', newest: '' })
    }

    if (articles) {
      const sorted = articles.sort((a, b) =>
        new Date(b.cached_at).getTime() - new Date(a.cached_at).getTime()
      )

      for (const article of sorted) {
        const stat = stats.get(article.topic)!
        stat.count++
        if (article.image_url) stat.withImage++
        if (!stat.newest) stat.newest = article.cached_at
        stat.oldest = article.cached_at
      }
    }

    // Get last fetch times
    const { data: fetchTimes } = await db
      .from('topic_fetches')
      .select('topic, last_fetched')
      .in('topic', topics)

    const lastFetchByTopic = new Map<string, string>()
    if (fetchTimes) {
      for (const row of fetchTimes) {
        lastFetchByTopic.set(row.topic, row.last_fetched)
      }
    }

    const result = topics.map(topic => {
      const stat = stats.get(topic)
      const lastFetched = lastFetchByTopic.get(topic)
      return {
        topic,
        count: stat?.count ?? 0,
        withImage: stat?.withImage ?? 0,
        withoutImage: (stat?.count ?? 0) - (stat?.withImage ?? 0),
        newest: stat?.newest ?? null,
        oldest: stat?.oldest ?? null,
        lastFetched: lastFetched ?? null,
      }
    })

    return new Response(JSON.stringify({
      userId,
      topics,
      stats: result,
      cutoff: cutoffIso,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[debug/stats] error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), { status: 500 })
  }
}
