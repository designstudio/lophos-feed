import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

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
      .from('articles')
      .delete()
      .in('topic', topics)

    await db
      .from('articles')
      .delete()
      .in('topic', topics)

    // Done! The next ingestion cycle will repopulate these topics.
    return new Response(JSON.stringify({
      success: true,
      message: `Cleared ${topics.length} topics. The next ingestion cycle will fetch updated articles.`,
      topics,
      nextStep: 'Wait for the next ingestion cycle to fetch fresh news',
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
