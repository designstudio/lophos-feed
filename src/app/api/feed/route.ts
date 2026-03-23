import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic, fetchImageForSources } from '@/lib/news'
import { NewsItem } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const FETCH_INTERVAL_MINUTES = 120

function isSearchStale(lastFetched: string | null): boolean {
  if (!lastFetched) return true
  return Date.now() - new Date(lastFetched).getTime() > FETCH_INTERVAL_MINUTES * 60 * 1000
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const body = await req.json()
  const forceRefresh: boolean = body.forceRefresh ?? false
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

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (items: NewsItem[]) => {
    if (items.length === 0) return
    await writer.write(encoder.encode(JSON.stringify({ items }) + '\n'))
  }

  const debugBuffer: any[] = []
  const emitDebug = (payload: any) => {
    if (!debug) return
    debugBuffer.push(payload)
  }

  const backfillImages = async (rows: any[]) => {
    const candidates = rows
      .filter(r => !r.image_url && Array.isArray(r.sources) && r.sources.length > 0)
      .slice(0, 12)
    if (candidates.length === 0) return

    await Promise.allSettled(candidates.map(async (row) => {
      try {
        const imageUrl = await fetchImageForSources(row.sources)
        if (!imageUrl) return
        await db.from('news_cache').update({ image_url: imageUrl }).eq('id', row.id)
        await db.from('articles').update({ image_url: imageUrl }).eq('id', row.id)
      } catch (e) {
        console.error('[feed] image backfill error:', e)
      }
    }))
  }

  const fetchAndStore = async (topic: string, existingTitles: string[]) => {
    console.log(`[feed][bg] fetchAndStore START for topic: ${topic}`)
    try {
      const fresh = await fetchNewsForTopic(topic, existingTitles, (stats) => emitDebug({ topic, ...stats }))
      console.log(`[feed][bg] fetchNewsForTopic completed for ${topic}, got ${fresh.length} articles`)
      if (fresh.length === 0) {
        console.log(`[feed][bg] no fresh articles for ${topic}`)
        return []
      }

      const rows = fresh.map(itemToRow)
      console.log(`[feed][bg] inserting ${rows.length} articles for ${topic}`)
      const { error } = await db.from('news_cache').insert(rows)
      if (error) {
        console.error(`[feed][bg] insert error "${topic}":`, error.message)
        return []
      }
      console.log(`[feed][bg] insert successful for ${topic}`)

      const { data: inserted } = await db
        .from('news_cache').select('*').eq('topic', topic)
        .order('cached_at', { ascending: false }).limit(rows.length)
      console.log(`[feed][bg] queried back ${inserted?.length ?? 0} articles for ${topic}`)

      if (inserted?.length) {
        console.log(`[feed][bg] upserting articles to articles table for ${topic}`)
        await db.from('articles').upsert(inserted, { onConflict: 'id' })
        // Backfill images for new articles in background
        backfillImages(inserted).catch(e => console.error('[feed] image backfill error for new items:', e))
        console.log(`[feed][bg] fetchAndStore COMPLETED for ${topic} with ${inserted.length} articles`)
        return inserted.map(rowToItem)
      }

      console.log(`[feed][bg] fetchAndStore found no inserted articles for ${topic}`)
      return []
    } catch (e) {
      console.error(`[feed][bg] fetchAndStore ERROR for ${topic}:`, e)
      throw e
    }
  }

  console.log(`[feed] handler START for user ${userId}`)
  ;(async () => {
    console.log(`[feed] IIFE START at ${new Date().toISOString()}`)
    await writer.write(encoder.encode(JSON.stringify({ topics }) + '\n'))
    if (debug) {
      await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'start' } }) + '\n'))
    }

    // 1. Load existing cache + fetch times
    const [{ data: allArticles }, fetchResult] = await Promise.all([
      db.from('news_cache').select('*').in('topic', topics).order('cached_at', { ascending: false }),
      db.from('topic_fetches').select('*').in('topic', topics),
    ])

    const cutoffIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const isRecentRow = (row: any) => {
      const d = row.published_at ?? row.cached_at
      if (!d) return false
      return new Date(d).getTime() >= new Date(cutoffIso).getTime()
    }

    const fetchTimes = fetchResult.data ?? []
    const byTopic = new Map<string, any[]>()
    for (const row of (allArticles ?? []).filter(isRecentRow)) {
      if (!byTopic.has(row.topic)) byTopic.set(row.topic, [])
      byTopic.get(row.topic)!.push(row)
    }
    const lastFetchByTopic = new Map<string, string>()
    for (const row of fetchTimes) lastFetchByTopic.set(row.topic, row.last_fetched)

    // 2. Stream existing cache immediately
    const allExisting = (allArticles ?? []).filter(isRecentRow)
      .map(rowToItem)
      .sort((a, b) =>
        new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
        new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
      )
    if (allExisting.length > 0) await send(allExisting)
    // Backfill missing images in background for cached items
    backfillImages(allArticles ?? []).catch(e => console.error('[feed] image backfill error:', e))

    const isColdStart = allExisting.length === 0
    if (isColdStart) {
      await writer.write(encoder.encode(JSON.stringify({ coldStart: true }) + '\n'))
    }

    // 3. Which topics need refresh?
    const topicsToFetch = topics.filter(t =>
      forceRefresh || isColdStart || isSearchStale(lastFetchByTopic.get(t) ?? null)
    )
    if (topicsToFetch.length === 0) {
      console.log(`[feed] no topics to fetch, closing writer`)
      await writer.close()
      return
    }

    // 4. Mark as fetching immediately to prevent duplicate requests
    const now = new Date().toISOString()
    await db.from('topic_fetches').upsert(
      topicsToFetch.map(topic => ({ topic, last_fetched: now, updated_at: now })),
      { onConflict: 'topic' }
    )
    let newItemsCount = 0
    const fetchAll = async (streamResults: boolean) => {
      console.log(`[feed][bg] fetchAll started for ${topicsToFetch.length} topics, streamResults=${streamResults}`)
      const concurrency = 3
      for (let i = 0; i < topicsToFetch.length; i += concurrency) {
        const batch = topicsToFetch.slice(i, i + concurrency)
        console.log(`[feed][bg] processing batch ${Math.floor(i/concurrency) + 1}: ${batch.join(', ')}`)
        await Promise.allSettled(batch.map(async (topic) => {
          try {
            const existingTitles = (byTopic.get(topic) ?? []).map((r: any) => r.title)
            const inserted = await fetchAndStore(topic, existingTitles)
            if (inserted.length > 0) newItemsCount += inserted.length
            if (streamResults && inserted.length > 0) await send(inserted)
          } catch (e) {
            console.error(`[feed] error "${topic}":`, e)
          }
        }))
      }
      console.log(`[feed][bg] fetchAll COMPLETED with ${newItemsCount} new items`)
    }

    // 5. Close writer IMMEDIATELY (don't wait for fetch on Vercel Free)
    console.log(`[feed][bg] closing writer at ${new Date().toISOString()}`)
    await writer.close()
    console.log(`[feed][bg] writer closed, launching background fetch for ${topicsToFetch.length} topics`)

    // 6. Launch background fetch (fire-and-forget)
    // Articles will be inserted into DB and visible on next refresh
    console.log(`[feed][bg] launching fetchAll at ${new Date().toISOString()}`)

    // Store the promise so it runs even if handler returns
    const backgroundTask = fetchAll(false)
      .then(() => {
        console.log(`[feed][bg] fetchAll completed at ${new Date().toISOString()}`)
      })
      .catch(err => {
        console.error('[feed][bg] background fetch error:', {
          topics: topicsToFetch,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        })
      })

    // Give the event loop a brief moment to let the task start
    // This helps ensure the Promise chain has begun before the response is sent
    await new Promise(r => setTimeout(r, 25))

    console.log(`[feed] IIFE returning at ${new Date().toISOString()}, background task has been initiated`)
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
    id: row.id, topic: row.topic, title: row.title, summary: row.summary,
    sections: row.sections || [], conclusion: row.conclusion || undefined,
    sources: row.sources, imageUrl: row.image_url,
    publishedAt: row.published_at, cachedAt: row.cached_at,
    tavilyRaw: row.tavily_raw,
  }
}

function itemToRow(item: NewsItem) {
  return {
    id: item.id, topic: item.topic, title: item.title, summary: item.summary,
    sections: item.sections || [], conclusion: item.conclusion || null,
    sources: item.sources, image_url: item.imageUrl || null,
    published_at: item.publishedAt, cached_at: item.cachedAt,
    tavily_raw: item.tavilyRaw || null,
  }
}

