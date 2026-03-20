import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic } from '@/lib/news'
import { NewsItem } from '@/lib/types'

export const maxDuration = 60

const FETCH_INTERVAL_MINUTES = 120 // check for new content every 2h

function isSearchStale(lastFetched: string | null): boolean {
  if (!lastFetched) return true
  return Date.now() - new Date(lastFetched).getTime() > FETCH_INTERVAL_MINUTES * 60 * 1000
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const body = await req.json()
  const forceRefresh: boolean = body.forceRefresh ?? false
  const db = getSupabaseAdmin()

  // Fetch topics from DB if not provided
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
    // Send topics immediately
    await writer.write(encoder.encode(JSON.stringify({ topics }) + '\n'))

    // 1. Fetch ALL existing articles + last fetch times in parallel
    const [{ data: allArticles }, fetchResult] = await Promise.all([
      db.from('news_cache').select('*').in('topic', topics).order('cached_at', { ascending: false }),
      db.from('topic_fetches').select('*').in('topic', topics),
    ])

    const fetchTimes = fetchResult.data ?? []
    if (fetchResult.error) {
      console.warn('[feed] topic_fetches table missing or error — run SQL migration. Will fetch all topics.')
    }

    // Group existing articles by topic
    const byTopic = new Map<string, any[]>()
    for (const row of allArticles ?? []) {
      if (!byTopic.has(row.topic)) byTopic.set(row.topic, [])
      byTopic.get(row.topic)!.push(row)
    }

    // Map last fetch times
    const lastFetchByTopic = new Map<string, string>()
    for (const row of fetchTimes ?? []) {
      lastFetchByTopic.set(row.topic, row.last_fetched)
    }

    // 2. Stream all existing articles sorted by recency — user sees content right away
    const allExisting = (allArticles ?? [])
      .map(rowToItem)
      .sort((a, b) =>
        new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
        new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
      )
    if (allExisting.length > 0) {
      await send(allExisting)
    }

    // 3. Determine which topics need a fresh search
    const topicsToFetch = topics.filter((topic) =>
      forceRefresh || isSearchStale(lastFetchByTopic.get(topic) ?? null)
    )

    if (topicsToFetch.length === 0) {
      await writer.close()
      return
    }

    // 4. Fetch new content in parallel, only insert truly new items
    await Promise.allSettled(
      topicsToFetch.map(async (topic) => {
        try {
          const existing = byTopic.get(topic) ?? []
          const existingTitles = existing.map((r: any) => r.title)

          // Update last_fetched timestamp regardless of outcome
          await db.from('topic_fetches').upsert(
            { topic, last_fetched: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: 'topic' }
          )

          const fresh = await fetchNewsForTopic(topic, existingTitles)

          if (fresh.length === 0) return // Gemini said no new events

          // Insert only new articles — don't touch existing ones
          const rows = fresh.map(itemToRow)
          const { error: insertErr } = await db.from('news_cache').insert(rows)
          if (insertErr) {
            console.error(`[feed] insert error for "${topic}":`, insertErr.message)
            return
          }

          // Fetch back with real UUIDs
          const { data: inserted } = await db
            .from('news_cache')
            .select('*')
            .eq('topic', topic)
            .order('cached_at', { ascending: false })
            .limit(rows.length)

          if (inserted?.length) {
            await db.from('articles').upsert(inserted, { onConflict: 'id' })
            // Send only the NEW items (client already has existing ones)
            await send(inserted.map(rowToItem))
          }
        } catch (e) {
          console.error(`[feed] error fetching "${topic}":`, e)
        }
      })
    )

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
