import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchNewsForTopic, fetchNewsForTopicFromResults, fetchImageForSources } from '@/lib/news'
import { NewsItem } from '@/lib/types'
import { XMLParser } from 'fast-xml-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FETCH_INTERVAL_MINUTES = 120
const RSS_FEEDS_PER_TOPIC = 3
const RSS_ITEMS_PER_FEED = 3
const RSS_TIMEOUT_MS = 4000
const CATEGORY_CACHE_DAYS = 30
const MAX_RUN_MS = 50000

function isSearchStale(lastFetched: string | null): boolean {
  if (!lastFetched) return true
  return Date.now() - new Date(lastFetched).getTime() > FETCH_INTERVAL_MINUTES * 60 * 1000
}

function topicSpecificity(topic: string): number {
  return topic.trim().split(/\s+/).filter(Boolean).length
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

  const fetchRssResults = async (topic: string) => {
    const getCategories = async () => {
      const { data, error } = await db.from('rss_feeds').select('topics').eq('active', true)
      if (error || !data) return []
      const set = new Set<string>()
      for (const row of data as any[]) {
        for (const t of (row.topics || [])) set.add(String(t))
      }
      return Array.from(set)
    }

    const loadCachedCategories = async (): Promise<string[] | null> => {
      try {
        const { data, error } = await db
          .from('topic_category_map')
          .select('categories, updated_at')
          .eq('topic', topic)
          .single()
        if (error || !data) return null
        const updated = new Date(data.updated_at).getTime()
        if (Date.now() - updated > CATEGORY_CACHE_DAYS * 24 * 60 * 60 * 1000) return null
        return (data.categories || []) as string[]
      } catch {
        return null
      }
    }

    const classifyTopic = async (cats: string[]): Promise<string[]> => {
      if (!process.env.GEMINI_API_KEY || cats.length === 0) return []
      const prompt = `Classifique o tópico abaixo em até 3 categorias da lista.

TÓPICO: "${topic}"
LISTA: ${cats.join(', ')}

Responda APENAS com JSON válido no formato:
{"categories":["...","..."]}`
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1 },
            }),
          }
        )
        if (!res.ok) return []
        const data = await res.json()
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
        if (!match) return []
        const parsed = JSON.parse(match[0])
        const categories = Array.isArray(parsed.categories) ? parsed.categories.map(String) : []
        return categories.slice(0, 3)
      } catch {
        return []
      }
    }

    // 1) Try exact topic match
    const { data: exactFeeds } = await db
      .from('rss_feeds')
      .select('url,name,topics,active')
      .eq('active', true)
      .contains('topics', [topic])
      .order('priority', { ascending: false })
      .limit(RSS_FEEDS_PER_TOPIC)
    if (exactFeeds && exactFeeds.length > 0) {
      return await fetchRssFromFeeds(exactFeeds)
    }

    // 2) Try cached or classified categories
    let categories = await loadCachedCategories()
    if (!categories) {
      const allCats = await getCategories()
      categories = await classifyTopic(allCats)
      if (categories.length > 0) {
        try {
          await db.from('topic_category_map').upsert(
            { topic, categories, updated_at: new Date().toISOString() },
            { onConflict: 'topic' }
          )
        } catch {}
      }
    }

    if (!categories || categories.length === 0) return []

    const feeds: any[] = []
    for (const cat of categories) {
      const { data } = await db
        .from('rss_feeds')
        .select('url,name,topics,active')
        .eq('active', true)
        .contains('topics', [cat])
        .order('priority', { ascending: false })
        .limit(RSS_FEEDS_PER_TOPIC)
      if (data && data.length > 0) {
        for (const f of data) {
          if (!feeds.find((x) => x.url === f.url)) feeds.push(f)
        }
      }
    }

    if (!feeds || feeds.length === 0) return []
    return await fetchRssFromFeeds(feeds)
  }

  const fetchRssFromFeeds = async (feeds: any[]) => {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
    const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000
    const results: any[] = []

    await Promise.allSettled(feeds.map(async (f: any) => {
      try {
        const res = await fetch(f.url, { signal: AbortSignal.timeout(RSS_TIMEOUT_MS) })
        if (!res.ok) return
        const xml = await res.text()
        const data = parser.parse(xml)

        const items =
          data?.rss?.channel?.item ||
          data?.feed?.entry ||
          data?.rdf?.item ||
          []

        const arr = Array.isArray(items) ? items : [items]
        for (const it of arr.slice(0, RSS_ITEMS_PER_FEED * 2)) {
          const title = it.title?.['#text'] ?? it.title ?? ''
          const link =
            it.link?.href ||
            it.link?.[0]?.href ||
            it.link ||
            it.guid ||
            ''
          const content =
            it['content:encoded'] ||
            it.content?.['#text'] ||
            it.content ||
            it.summary?.['#text'] ||
            it.summary ||
            it.description ||
            ''
          const pub =
            it.pubDate ||
            it.published ||
            it.updated ||
            it['dc:date'] ||
            null
          const ts = pub ? new Date(pub).getTime() : 0
          if (ts && ts < cutoff) continue

          let image =
            it.enclosure?.url ||
            it['media:content']?.url ||
            it['media:thumbnail']?.url ||
            null

          if (!title || !link) continue
          results.push({ url: link, title, content, image })
          if (results.length >= RSS_FEEDS_PER_TOPIC * RSS_ITEMS_PER_FEED) break
        }
      } catch {}
    }))

    return results
  }

  const fetchAndStore = async (topic: string, existingTitles: string[], globalExistingTitles: string[]) => {
    const combinedTitles = Array.from(new Set([...existingTitles, ...globalExistingTitles]))
    let fresh: NewsItem[] = []
    const rssResults = await fetchRssResults(topic)
    if (rssResults.length > 0) {
      fresh = await fetchNewsForTopicFromResults(topic, rssResults, combinedTitles, (stats) => emitDebug({ topic, source: 'rss', ...stats }))
    } else {
      fresh = await fetchNewsForTopic(topic, combinedTitles, (stats) => emitDebug({ topic, source: 'tavily', ...stats }))
    }
    if (fresh.length === 0) return []

    const rows = fresh.map(itemToRow)
    const { error } = await db.from('news_cache').insert(rows)
    if (error) {
      console.error(`[feed] insert error "${topic}":`, error.message)
      return []
    }

    const { data: inserted } = await db
      .from('news_cache').select('*').eq('topic', topic)
      .order('cached_at', { ascending: false }).limit(rows.length)
    if (inserted?.length) {
      await db.from('articles').upsert(inserted, { onConflict: 'id' })
      for (const row of inserted) {
        if (row?.title) globalExistingTitles.push(row.title)
      }
      return inserted.map(rowToItem)
    }

    return []
  }

  ;(async () => {
    const startedAt = Date.now()
    try {
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

    if (debug) {
      const { data: recentRows } = await db
        .from('news_cache')
        .select('topic, published_at, cached_at')
        .in('topic', topics)
        .or(`published_at.gte.${cutoffIso},cached_at.gte.${cutoffIso}`)

      const counts: Record<string, number> = {}
      for (const t of topics) counts[t] = 0
      for (const row of (recentRows ?? [])) {
        const t = row.topic as string
        counts[t] = (counts[t] || 0) + 1
      }
      await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'db', recentCounts: counts } }) + '\n'))
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
    const globalExistingTitles = allExisting.map((item) => item.title).filter(Boolean)
    if (allExisting.length > 0) await send(allExisting)
    // Backfill missing images in background for cached items
    backfillImages(allArticles ?? []).catch(e => console.error('[feed] image backfill error:', e))

    const isColdStart = allExisting.length === 0
    if (isColdStart) {
      await writer.write(encoder.encode(JSON.stringify({ coldStart: true }) + '\n'))
    }

    // 3. Which topics need refresh?
    const topicsToFetch = topics
      .filter(t => forceRefresh || isColdStart || isSearchStale(lastFetchByTopic.get(t) ?? null))
      .sort((a, b) => topicSpecificity(b) - topicSpecificity(a))
    if (topicsToFetch.length === 0) { await writer.close(); return }

    // 4. Mark as fetching immediately to prevent duplicate requests
    const now = new Date().toISOString()
    await db.from('topic_fetches').upsert(
      topicsToFetch.map(topic => ({ topic, last_fetched: now, updated_at: now })),
      { onConflict: 'topic' }
    )
    let newItemsCount = 0
    const fetchAll = async (streamResults: boolean) => {
      // Process sequentially to preserve specificity-based priority and avoid cross-topic duplicates.
      for (const topic of topicsToFetch) {
        const elapsed = Date.now() - startedAt
        if (elapsed > MAX_RUN_MS) {
          if (debug) emitDebug({ phase: 'cutoff', reason: 'time_budget', elapsedMs: elapsed })
          break
        }
        try {
          const existingTitles = (byTopic.get(topic) ?? []).map((r: any) => r.title)
          const inserted = await fetchAndStore(topic, existingTitles, globalExistingTitles)
          if (inserted.length > 0) newItemsCount += inserted.length
          if (streamResults && inserted.length > 0) await send(inserted)
        } catch (e) {
          if (debug) emitDebug({ topic, error: e instanceof Error ? e.message : String(e) })
          console.error(`[feed] error "${topic}":`, e)
        }
      }
    }

    // 5. Fetch inline so we can notify completion to the client
    await fetchAll(true)
    if (debug) {
      await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'done', items: debugBuffer } }) + '\n'))
    }
    await writer.write(encoder.encode(JSON.stringify({ refreshComplete: true, newItemsCount }) + '\n'))
    await writer.close()
    } catch (e) {
      if (debug) {
        const message = e instanceof Error ? e.message : String(e)
        await writer.write(encoder.encode(JSON.stringify({ debug: { phase: 'error', message } }) + '\n'))
      }
      console.error('[feed] stream error:', e)
      await writer.close()
    }
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
  }
}

function itemToRow(item: NewsItem) {
  return {
    id: item.id, topic: item.topic, title: item.title, summary: item.summary,
    sections: item.sections || [], conclusion: item.conclusion || null,
    sources: item.sources, image_url: item.imageUrl || null,
    published_at: item.publishedAt, cached_at: item.cachedAt,
  }
}

