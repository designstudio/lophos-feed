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

    await db
      .from('raw_articles')
      .delete()
      .in('topic', topics)

    // 3. Clear topic_fetches to force refetch on next request
    await db
      .from('topic_fetches')
      .delete()
      .in('topic', topics)

    // Done! Next feed request will force refetch with new queries
    return new Response(JSON.stringify({
      success: true,
      message: `Cleared ${topics.length} topics. Next feed request will refetch with updated queries.`,
      topics,
      nextStep: 'Open the feed page and click "Atualizar" to fetch fresh news',
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[refresh-all] error:', error)
    return new Response(JSON.stringify({ error: 'Failed to clear cache' }), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRefresh(req)
}

export async function POST(req: NextRequest) {
  return handleRefresh(req)
}
