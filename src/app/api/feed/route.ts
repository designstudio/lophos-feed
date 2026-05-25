import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isLikelyStaleLaunchArticle } from '@/lib/news-preprocessing'
import { NewsItem } from '@/lib/types'
import { loadBlockedTopics } from '@/lib/topic-signals'

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

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    let requestAborted = req.signal.aborted
    let writerClosed = false

    const abortWriter = async () => {
      if (writerClosed) return
      try {
        await writer.abort(new Error('Feed request aborted by client'))
      } catch (abortErr) {
        console.error('[feed] writer abort error:', serializeError(abortErr))
      } finally {
        writerClosed = true
      }
    }

    const handleAbort = () => {
      requestAborted = true
      console.warn('[feed] request aborted by client')
      void abortWriter()
    }

    req.signal.addEventListener('abort', handleAbort, { once: true })

    const writeChunk = async (payload: unknown) => {
      if (requestAborted) return false
      try {
        await writer.write(encoder.encode(JSON.stringify(payload) + '\n'))
        return true
      } catch (writeErr) {
        if (requestAborted) return false
        throw writeErr
      }
    }

    const send = async (items: NewsItem[]) => {
      if (items.length === 0) return
      await writeChunk({ items })
    }

    const closeWriter = async () => {
      if (requestAborted || writerClosed) return
      try {
        await writer.close()
      } catch (closeErr) {
        if (!requestAborted) {
          console.error('[feed] writer close error:', serializeError(closeErr))
        }
      } finally {
        writerClosed = true
      }
    }

    console.log(`[feed] handler START for user ${userId}`)

    ;(async () => {
      try {
        console.log(`[feed] stream task START at ${new Date().toISOString()}`)
        // Send an immediate chunk so proxies/clients don't wait several seconds
        // for the first byte while we load user topics and query the feed RPC.
        if (!(await writeChunk({ ready: true }))) return

        let topics: string[] = body.topics ?? []
        if (topics.length === 0) {
          const { data, error } = await db
            .from('user_topics')
            .select('topic')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })

          if (error) {
            console.error('[feed] error loading user topics:', error)
            await writeChunk({
              error: 'Failed to load user topics',
              detail: includeErrorDetails ? serializeError(error) : undefined,
            })
            await closeWriter()
            return
          }

          topics = (data ?? []).map((r: any) => r.topic)
          console.log(
            `[feed] fetched ${topics.length} topics from user_topics for user ${userId}: ${JSON.stringify(topics)}`,
          )
        }

        if (topics.length === 0) {
          console.warn(`[feed] no topics found for user ${userId}`)
          await writeChunk({ error: 'No topics' })
          await closeWriter()
          return
        }

        if (!(await writeChunk({ topics }))) return
        if (debug) {
          if (!(await writeChunk({ debug: { phase: 'start' } }))) return
        }

        console.log(
          `[feed] calling get_personalized_feed with topics=${JSON.stringify(topics)}, days=${days}`,
        )
        const blockedTopics = await loadBlockedTopics(db, userId, topics)
        if (requestAborted) return
        console.log(`[feed] blocked topics=${JSON.stringify(blockedTopics)}`)
        const { data: allArticles, error } = await db.rpc('get_personalized_feed', {
          p_user_id: userId,
          p_topics: topics,
          p_days: days,
          p_excluded_topics: blockedTopics,
        })

        if (error) {
          console.error('[feed] RPC error:', error)
          await writeChunk({
            error: 'RPC get_personalized_feed failed',
            detail: includeErrorDetails ? serializeError(error) : undefined,
          })
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
        const visibleItems = allExisting.filter((item: NewsItem) => !isLikelyStaleLaunchArticle({
          title: item.title,
          description: item.summary,
          sourceName: item.sources?.[0]?.name || '',
          topic: item.topic,
        }))

        const filteredOut = allExisting.length - visibleItems.length
        if (filteredOut > 0) {
          console.warn(`[feed] filtered ${filteredOut} stale/archived article(s) before sending to client`)
        }

        if (visibleItems.length > 0) {
          await send(visibleItems)
        }

        if (visibleItems.length === 0) {
          if (!(await writeChunk({ coldStart: true }))) return
        }

        await writeChunk({ refreshComplete: true })

        console.log(`[feed] closing writer at ${new Date().toISOString()}`)
        await closeWriter()
      } catch (streamErr) {
        if (requestAborted) {
          console.warn('[feed] stream task stopped after abort')
          return
        }
        console.error('[feed] stream task failed:', streamErr)
        try {
          await writeChunk({
            error: 'Feed streaming failed',
            detail: includeErrorDetails ? serializeError(streamErr) : undefined,
          })
        } catch {}
        await closeWriter()
      } finally {
        req.signal.removeEventListener('abort', handleAbort)
      }
    })().catch((unhandledErr) => {
      console.error('[feed] unhandled stream task rejection:', unhandledErr)
    })

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
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
