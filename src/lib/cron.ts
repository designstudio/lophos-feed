import cron from 'node-cron'
import { getSupabaseAdmin } from './supabase'
import { fetchNewsForTopic } from './news'

const INTERVAL = '0 */2 * * *' // Every 2 hours

export function startFeedCron() {
  console.log('[cron] Starting feed refresh scheduler (every 2 hours)')

  cron.schedule(INTERVAL, async () => {
    console.log(`[cron] Running feed refresh at ${new Date().toISOString()}`)
    try {
      await refreshAllFeeds()
    } catch (err) {
      console.error('[cron] Error during feed refresh:', err)
    }
  })
}

async function refreshAllFeeds() {
  const db = getSupabaseAdmin()

  // Get all topics (dedup in memory)
  const { data: topics, error: topicsError } = await db
    .from('user_topics')
    .select('topic')

  if (topicsError) {
    console.error('[cron] Error fetching topics:', topicsError)
    return
  }

  if (!topics || topics.length === 0) {
    console.log('[cron] No topics to refresh')
    return
  }

  // Remove duplicates
  const uniqueTopics = Array.from(new Set(topics.map((t: any) => t.topic)))
  console.log(`[cron] Refreshing ${uniqueTopics.length} topics`)

  // Process topics in parallel batches (concurrency of 3)
  const concurrency = 3
  for (let i = 0; i < uniqueTopics.length; i += concurrency) {
    const batch = uniqueTopics.slice(i, i + concurrency)
    await Promise.allSettled(
      batch.map(async (topic) => {
        try {
          // Get existing titles to avoid duplicates
          const { data: existing } = await db
            .from('news_cache')
            .select('title')
            .eq('topic', topic)
            .order('cached_at', { ascending: false })
            .limit(100)

          const existingTitles = (existing ?? []).map((r: any) => r.title)

          // Fetch and store new items
          await fetchNewsForTopic(topic, existingTitles)
          console.log(`[cron] ✓ Refreshed topic: ${topic}`)
        } catch (err) {
          console.error(`[cron] ✗ Error refreshing topic "${topic}":`, err)
        }
      })
    )
  }

  console.log('[cron] Feed refresh completed')
}
