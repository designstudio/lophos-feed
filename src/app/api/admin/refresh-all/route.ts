import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic } from '@/lib/news'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function handleRefresh(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const db = getSupabaseAdmin()

  try {
    // 1. Get user topics
    const { data: userTopics } = await db
      .from('user_topics')
      .select('topic')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    const topics = (userTopics ?? []).map(r => r.topic)

    if (topics.length === 0) {
      return new Response(JSON.stringify({ error: 'No topics configured' }), { status: 400 })
    }

    // 2. Clear old articles for these topics
    await db
      .from('news_cache')
      .delete()
      .in('topic', topics)

    await db
      .from('articles')
      .delete()
      .in('topic', topics)

    // 3. Clear topic_fetches to force refetch
    await db
      .from('topic_fetches')
      .delete()
      .in('topic', topics)

    // 4. Fetch fresh news for all topics
    const allItems = []
    for (const topic of topics) {
      try {
        const items = await fetchNewsForTopic(topic, [])
        allItems.push(...items)
      } catch (e) {
        console.error(`[refresh-all] error fetching "${topic}":`, e)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Refreshed ${topics.length} topics, found ${allItems.length} total articles`,
      topics,
      itemsCount: allItems.length,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[refresh-all] error:', error)
    return new Response(JSON.stringify({ error: 'Failed to refresh' }), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRefresh(req)
}

export async function POST(req: NextRequest) {
  return handleRefresh(req)
}
