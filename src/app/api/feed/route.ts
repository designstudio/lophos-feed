import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300


export async function POST(req: NextRequest) {
  console.log('🔥 FEED ROUTE CALLED AT', new Date().toISOString())
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const body = await req.json()
  const days: number = body.days ?? 2
  const db = getSupabaseAdmin()

  let topics: string[] = body.topics ?? []
  if (topics.length === 0) {
    const { data } = await db
      .from('user_topics').select('topic').eq('user_id', userId)
      .order('created_at', { ascending: true })
    topics = (data ?? []).map((r: any) => r.topic)
  }

  if (topics.length === 0)
    return new Response(JSON.stringify({ error: 'No topics' }), { status: 400 })

  // Load excluded topics for this user
  const { data: excludedData } = await db
    .from('user_excluded_topics').select('topic').eq('user_id', userId)
  const excludedTopics: string[] = (excludedData ?? []).map((r: any) => r.topic)

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (items: NewsItem[]) => {
    if (items.length === 0) return
    await writer.write(encoder.encode(JSON.stringify({ items }) + '\n'))
  }

  console.log(`[feed] handler START for user ${userId}`)
  ;(async () => {
    console.log(`[feed] IIFE START at ${new Date().toISOString()}`)
    await writer.write(encoder.encode(JSON.stringify({ topics }) + '\n'))
    if (debug) {
      await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'start' } }) + '\n'))
    }

    // Feed personalizado via RPC — ordenado por afinidade de keywords com likes recentes,
    // depois por data. Dislikes e tópicos excluídos são filtrados no banco.
    const { data: allArticles, error } = await db.rpc('get_personalized_feed', {
      p_user_id: userId,
      p_topics: topics,
      p_days: days,
      p_excluded_topics: excludedTopics,
    })

    if (error) {
      console.error('[feed] RPC error:', error)
    }

    const allExisting = (allArticles ?? []).map((row: any) => rowToItem(row, topics))

    if (allExisting.length > 0) await send(allExisting)

    const isColdStart = allExisting.length === 0
    if (isColdStart) {
      await writer.write(encoder.encode(JSON.stringify({ coldStart: true }) + '\n'))
    }

    console.log(`[feed] closing writer at ${new Date().toISOString()}`)
    await writer.close()
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}

function rowToItem(row: any, userTopics?: string[]): NewsItem {
  // Find which user topic matched this article
  const matchedTopics: string[] = row.matched_topics ?? []
  const displayTopic = userTopics?.find(t => matchedTopics.includes(t)) ?? row.topic

  return {
    id: row.id, topic: row.topic, displayTopic, title: row.title, summary: row.summary,
    sections: row.sections || [], conclusion: row.conclusion || undefined,
    sources: row.sources, imageUrl: row.image_url, videoUrl: row.video_url,
    publishedAt: row.published_at, cachedAt: row.cached_at,
    tavilyRaw: row.tavily_raw,
  }
}


