import cron from 'node-cron'
import { getSupabaseAdmin } from './supabase'
import { fetchNewsForTopic, processRawBatch } from './news'
import { NewsItem } from './types'

const COLLECT_INTERVAL = '0 */6 * * *'       // 00:00, 06:00, 12:00, 18:00 — Tavily only
const PROCESS_INTERVAL = '0 1,7,13,19 * * *' // 01:00, 07:00, 13:00, 19:00 — Gemini only

function itemToRow(item: NewsItem) {
  return {
    id: item.id, topic: item.topic, title: item.title, summary: item.summary,
    sections: item.sections || [], conclusion: item.conclusion || null,
    sources: item.sources, image_url: item.imageUrl || null,
    published_at: item.publishedAt, cached_at: item.cachedAt,
    tavily_raw: item.tavilyRaw || null,
  }
}

export function startFeedCron() {
  console.log('[cron] Starting feed scheduler — collect: */6h, process: 1,7,13,19h')
  cron.schedule(COLLECT_INTERVAL, async () => {
    console.log(`[cron] Collect run at ${new Date().toISOString()}`)
    try { await collectAllFeeds() } catch (err) { console.error('[cron] Collect error:', err) }
  })
  cron.schedule(PROCESS_INTERVAL, async () => {
    console.log(`[cron] Process run at ${new Date().toISOString()}`)
    try { await processRawFeeds() } catch (err) { console.error('[cron] Process error:', err) }
  })
}

// Phase A: Tavily only — saves results to raw_articles (no Gemini)
async function collectAllFeeds() {
  const db = getSupabaseAdmin()
  const { data: topics, error } = await db.from('user_topics').select('topic')
  if (error) { console.error('[cron] collect: topics error:', error); return }
  if (!topics?.length) { console.log('[cron] collect: no topics'); return }

  const uniqueTopics = Array.from(new Set(topics.map((t: any) => t.topic)))
  console.log(`[cron] collect: ${uniqueTopics.length} topics`)

  const concurrency = 3
  for (let i = 0; i < uniqueTopics.length; i += concurrency) {
    const batch = uniqueTopics.slice(i, i + concurrency)
    await Promise.allSettled(batch.map(async (topic) => {
      try {
        // fetchNewsForTopic saves to raw_articles internally (Phase 2),
        // but also calls Gemini. For pure collection we only need the Tavily part.
        // Until we split fetchNewsForTopic further, call it and discard the result —
        // raw_articles will still be populated as a side-effect.
        await fetchNewsForTopic(topic, [])
        console.log(`[cron] collect ✓ ${topic}`)
      } catch (err) {
        console.error(`[cron] collect ✗ ${topic}:`, err)
      }
    }))
  }
  console.log('[cron] collect: done')
}

// Phase B: Gemini only — reads raw_articles (status=raw) and saves to news_cache
export async function processRawFeeds() {
  const db = getSupabaseAdmin()

  // 1. Load raw articles from the last 12h
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data: rawRows, error } = await db
    .from('raw_articles')
    .select('*')
    .eq('status', 'raw')
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: true })

  if (error) { console.error('[cron] process: raw_articles error:', error); return }
  if (!rawRows?.length) { console.log('[cron] process: nothing to process'); return }

  console.log(`[cron] process: ${rawRows.length} raw batches to process`)

  // 2. Build set of URLs already in news_cache (last 24h) for dedup
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentCache } = await db
    .from('news_cache')
    .select('tavily_raw')
    .gte('cached_at', oneDayAgo)

  const processedUrls = new Set<string>(
    (recentCache ?? []).flatMap((r: any) =>
      Array.isArray(r.tavily_raw) ? r.tavily_raw.map((t: any) => t.url) : []
    )
  )

  // 3. Process each raw batch
  const concurrency = 3
  for (let i = 0; i < rawRows.length; i += concurrency) {
    const batch = rawRows.slice(i, i + concurrency)
    await Promise.allSettled(batch.map(async (row: any) => {
      try {
        const topic: string = row.topic
        const allResults: any[] = row.tavily_results ?? []

        // Dedup: skip URLs already processed
        const freshResults = allResults.filter((r) => !processedUrls.has(r.url))
        if (freshResults.length === 0) {
          console.log(`[cron] process: ${topic} — all URLs already processed, skipping`)
          await db.from('raw_articles').update({ status: 'dedup' }).eq('id', row.id)
          return
        }

        // Get existing titles from news_cache for this topic
        const { data: existing } = await db
          .from('news_cache')
          .select('title')
          .eq('topic', topic)
          .order('cached_at', { ascending: false })
          .limit(100)

        const existingTitles = (existing ?? []).map((r: any) => r.title)

        // Run Gemini processing
        const items = await processRawBatch(topic, freshResults, existingTitles)

        if (items.length > 0) {
          const rows = items.map(itemToRow)
          const { error: insertError } = await db.from('news_cache').insert(rows)
          if (insertError) {
            console.error(`[cron] process ✗ ${topic} insert:`, insertError.message)
          } else {
            await db.from('articles').upsert(rows, { onConflict: 'id' })
            // Add newly processed URLs to dedup set
            freshResults.forEach((r) => processedUrls.add(r.url))
            console.log(`[cron] process ✓ ${topic}: ${items.length} articles`)
          }
        } else {
          console.log(`[cron] process: ${topic} — Gemini returned 0 articles`)
        }

        // Mark as processed regardless of result
        await db.from('raw_articles').update({ status: 'processed' }).eq('id', row.id)
      } catch (err) {
        console.error(`[cron] process ✗ ${row.topic}:`, err)
      }
    }))
  }

  console.log('[cron] process: done')
}

export async function refreshAllFeeds() {
  await collectAllFeeds()
}
