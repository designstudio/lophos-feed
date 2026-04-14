import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const includeErrorDetails = process.env.NODE_ENV !== 'production'

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: includeErrorDetails ? err.stack : undefined,
    }
  }

  return {
    message: String(err),
  }
}

function jsonError(status: number, message: string, err?: unknown) {
  return new Response(
    JSON.stringify({
      error: message,
      ...(includeErrorDetails && err ? { detail: serializeError(err) } : {}),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export async function POST(req: NextRequest) {
  console.log('[feed] route called at', new Date().toISOString())

  try {
    const { userId } = await auth()
    if (!userId) return jsonError(401, 'Unauthorized')

    const debug = req.nextUrl.searchParams.get('debug') === '1'
    const body = await req.json()
    const days: number = body.days ?? 2
    const db = getSupabaseAdmin()

    let topics: string[] = body.topics ?? []
    if (topics.length === 0) {
      const { data, error } = await db
        .from('user_topics')
        .select('topic')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[feed] error loading user topics:', error)
        return jsonError(500, 'Failed to load user topics', error)
      }

      topics = (data ?? []).map((r: any) => r.topic)
      console.log(`[feed] fetched ${topics.length} topics from user_topics for user ${userId}: ${JSON.stringify(topics)}`)
    }

    if (topics.length === 0) {
      console.warn(`[feed] no topics found for user ${userId}`)
      return jsonError(400, 'No topics')
    }

    const { data: excludedData, error: excludedError } = await db
      .from('user_excluded_topics')
      .select('topic')
      .eq('user_id', userId)

    if (excludedError) {
      console.error('[feed] error loading excluded topics:', excludedError)
      return jsonError(500, 'Failed to load excluded topics', excludedError)
    }

    const excludedTopics: string[] = (excludedData ?? []).map((r: any) => r.topic)
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const send = async (items: NewsItem[]) => {
      if (items.length === 0) return
      await writer.write(encoder.encode(JSON.stringify({ items }) + '\n'))
    }

    const closeWriter = async () => {
      try {
        await writer.close()
      } catch (closeErr) {
        console.error('[feed] writer close error:', serializeError(closeErr))
      }
    }

    console.log(`[feed] handler START for user ${userId}`)

    ;(async () => {
      try {
        console.log(`[feed] stream task START at ${new Date().toISOString()}`)
        await writer.write(encoder.encode(JSON.stringify({ topics }) + '\n'))
        if (debug) {
          await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'start' } }) + '\n'))
        }

        console.log(
          `[feed] calling get_personalized_feed with topics=${JSON.stringify(topics)}, days=${days}, excluded=${JSON.stringify(excludedTopics)}`,
        )
        const { data: allArticles, error } = await db.rpc('get_personalized_feed', {
          p_user_id: userId,
          p_topics: topics,
          p_days: days,
          p_excluded_topics: excludedTopics,
        })

        if (error) {
          console.error('[feed] RPC error:', error)
          await writer.write(
            encoder.encode(
              JSON.stringify({
                error: 'RPC get_personalized_feed failed',
                detail: includeErrorDetails ? serializeError(error) : undefined,
              }) + '\n',
            ),
          )
          await closeWriter()
          return
        }

        console.log(`[feed] RPC returned ${(allArticles ?? []).length} articles`)
        if ((allArticles ?? []).length > 0) {
          console.log(
            `[feed] first article: title="${allArticles[0].title}", matched_topics=${JSON.stringify(allArticles[0].matched_topics)}`,
          )
        }

        const allExisting = (allArticles ?? []).map((row: any) => rowToItem(row, topics))

        if (allExisting.length > 0) {
          await send(allExisting)
        }

        if (allExisting.length === 0) {
          await writer.write(encoder.encode(JSON.stringify({ coldStart: true }) + '\n'))
        }

        await writer.write(encoder.encode(JSON.stringify({ refreshComplete: true }) + '\n'))

        console.log(`[feed] closing writer at ${new Date().toISOString()}`)
        await closeWriter()
      } catch (streamErr) {
        console.error('[feed] stream task failed:', streamErr)
        try {
          await writer.write(
            encoder.encode(
              JSON.stringify({
                error: 'Feed streaming failed',
                detail: includeErrorDetails ? serializeError(streamErr) : undefined,
              }) + '\n',
            ),
          )
        } catch {}
        await closeWriter()
      }
    })().catch((unhandledErr) => {
      console.error('[feed] unhandled stream task rejection:', unhandledErr)
    })

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[feed] route failed:', err)
    return jsonError(500, 'Failed to load feed', err)
  }
}

function rowToItem(row: any, userTopics?: string[]): NewsItem {
  const matchedTopics: string[] = row.matched_topics ?? []
  const displayTopic = userTopics?.find((t) => matchedTopics.includes(t)) ?? row.topic

  return {
    id: row.id,
    topic: row.topic,
    displayTopic,
    title: row.title,
    summary: row.summary,
    sections: row.sections || [],
    conclusion: row.conclusion || undefined,
    sources: row.sources,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
    tavilyRaw: row.tavily_raw,
  }
}
