import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic } from '@/lib/news'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FETCH_INTERVAL_MINUTES = 120

function isSearchStale(lastFetched: string | null): boolean {
  if (!lastFetched) return true
  return Date.now() - new Date(lastFetched).getTime() > FETCH_INTERVAL_MINUTES * 60 * 1000
}

// ─── Call the RSS synthesize endpoint internally ───────────────
async function synthesizeFromRSS(
  topics: string[],
  forceRefresh: boolean,
  baseUrl: string,
  authHeader: string
): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${baseUrl}/api/rss/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ topics, forceRefresh }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((row: any) => rowToItem(row))
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const body = await req.json()
  const forceRefresh: boolean = body.forceRefresh ?? false
  const db = getSupabaseAdmin()

  let topics: string[] = body.topics ?? []
  if (topics.length === 0) {
    const { data } = await db
      .from('user_topics')
      .select('topic')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    topics = (data ?? []).map((r: any) => r.topic)
  }

  if (topics.length === 0) {
    return new Response(JSON.stringify({ error: 'No topics' }), { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (items: NewsItem[]) => {
    if (items.length === 0) return
    await writer.write(encoder.encode(JSON.stringify({ items }) + '\n'))
  }

  ;(async () => {
    await writer.write(encoder.encode(JSON.stringify({ topics }) + '\n'))

    // 1. Load existing cache + fetch times
    const [{ data: allArticles }, fetchResult] = await Promise.all([
      db.from('news_cache').select('*').in('topic', topics).order('cached_at', { ascending: false }),
      db.from('topic_fetches').select('*').in('topic', topics),
    ])

    const fetchTimes = fetchResult.data ?? []
    const byTopic = new Map<string, any[]>()
    for (const row of allArticles ?? []) {
      if (!byTopic.has(row.topic)) byTopic.set(row.topic, [])
      byTopic.get(row.topic)!.push(row)
    }
    const lastFetchByTopic = new Map<string, string>()
    for (const row of fetchTimes ?? []) {
      lastFetchByTopic.set(row.topic, row.last_fetched)
    }

    // 2. Stream existing articles immediately
    const allExisting = (allArticles ?? [])
      .map(rowToItem)
      .sort((a, b) =>
        new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
        new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
      )
    if (allExisting.length > 0) await send(allExisting)

    // 3. Which topics need refresh?
    const topicsToFetch = topics.filter(t =>
      forceRefresh || isSearchStale(lastFetchByTopic.get(t) ?? null)
    )
    if (topicsToFetch.length === 0) { await writer.close(); return }

    // 4. Try RSS synthesis first
    const baseUrl = req.nextUrl.origin
    const authHeader = req.headers.get('authorization') || ''
    const rssItems = await synthesizeFromRSS(topicsToFetch, forceRefresh, baseUrl, authHeader)

    if (rssItems.length > 0) {
      await send(rssItems)
    }

    // 5. Fallback to Tavily for topics that got no RSS results
    const coveredTopics = new Set(rssItems.map(i => i.topic))
    const fallbackTopics = topicsToFetch.filter(t => !coveredTopics.has(t))

    if (fallbackTopics.length > 0) {
      await Promise.allSettled(
        fallbackTopics.map(async (topic) => {
          try {
            const existing = byTopic.get(topic) ?? []
            const existingTitles = existing.map((r: any) => r.title)

            await db.from('topic_fetches').upsert(
              { topic, last_fetched: new Date().toISOString(), updated_at: new Date().toISOString() },
              { onConflict: 'topic' }
            )

            const fresh = await fetchNewsForTopic(topic, existingTitles)
            if (fresh.length === 0) return

            const rows = fresh.map(itemToRow)
            const { error: insertErr } = await db.from('news_cache').insert(rows)
            if (insertErr) { console.error(`[feed] insert error "${topic}":`, insertErr.message); return }

            const { data: inserted } = await db
              .from('news_cache').select('*').eq('topic', topic)
              .order('cached_at', { ascending: false }).limit(rows.length)

            if (inserted?.length) {
              await db.from('articles').upsert(inserted, { onConflict: 'id' })
              await send(inserted.map(rowToItem))
            }
          } catch (e) {
            console.error(`[feed] fallback error "${topic}":`, e)
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
    sections: row.sections || [],
    conclusion: row.conclusion || undefined,
    sources: row.sources,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
  }
}

function itemToRow(item: NewsItem) {
  return {
    topic: item.topic,
    title: item.title,
    summary: item.summary,
    sections: item.sections || [],
    conclusion: item.conclusion || null,
    sources: item.sources,
    image_url: item.imageUrl || null,
    published_at: item.publishedAt,
    cached_at: item.cachedAt,
  }
}
