import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic, isCacheStale } from '@/lib/news'
import { NewsItem } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { topics, forceRefresh = false } = await req.json()
  if (!Array.isArray(topics) || topics.length === 0) {
    return new Response(JSON.stringify({ error: 'Topics required' }), { status: 400 })
  }

  const db = getSupabaseAdmin()

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (items: NewsItem[]) => {
    if (items.length === 0) return
    await writer.write(encoder.encode(JSON.stringify({ items }) + '\n'))
  }

  ;(async () => {
    // 1. ONE query — fetch all cached items for all topics at once
    const staleTopics: string[] = [...topics]

    if (!forceRefresh) {
      const { data: allCached } = await db
        .from('news_cache')
        .select('*')
        .in('topic', topics)
        .order('cached_at', { ascending: false })

      if (allCached && allCached.length > 0) {
        // Group by topic
        const byTopic = new Map<string, any[]>()
        for (const row of allCached) {
          if (!byTopic.has(row.topic)) byTopic.set(row.topic, [])
          byTopic.get(row.topic)!.push(row)
        }

        // Send fresh cached topics immediately, collect stale ones
        staleTopics.length = 0
        for (const topic of topics) {
          const rows = byTopic.get(topic)
          if (rows && rows.length > 0 && !isCacheStale(rows[0].cached_at)) {
            // Fresh — send immediately
            await send(rows.slice(0, 4).map(rowToItem))
          } else {
            // Stale or missing — needs refresh
            staleTopics.push(topic)
          }
        }
      }
    }

    // 2. Fetch only stale/missing topics in parallel
    if (staleTopics.length > 0) {
      await Promise.allSettled(
        staleTopics.map(async (topic) => {
          try {
            const fresh = await fetchNewsForTopic(topic)
            if (fresh.length > 0) {
              await db.from('news_cache').delete().eq('topic', topic)
              const rows = fresh.map(itemToRow)
              await db.from('news_cache').insert(rows)
              await db.from('articles').upsert(rows, { onConflict: 'id' })
              await send(fresh)
            }
          } catch (e) {
            console.error(`Error fetching topic "${topic}":`, e)
            // Fallback: stale cache is better than nothing
            const { data: stale } = await db
              .from('news_cache')
              .select('*')
              .eq('topic', topic)
              .order('cached_at', { ascending: false })
              .limit(4)
            if (stale?.length) await send(stale.map(rowToItem))
          }
        })
      )
    }

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

function rowToItem(row: any): NewsItem {
  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    sources: row.sources,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
  }
}

function itemToRow(item: NewsItem) {
  return {
    id: item.id,
    topic: item.topic,
    title: item.title,
    summary: item.summary,
    sources: item.sources,
    image_url: item.imageUrl || null,
    published_at: item.publishedAt,
    cached_at: item.cachedAt,
  }
}
