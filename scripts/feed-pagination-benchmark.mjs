import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const PAGE_SIZE = 30
const PAGE_QUERY_SIZE = PAGE_SIZE + 1
const FEED_SELECT = 'id,topic,title,summary,sources,image_url,published_at,cached_at,matched_topics,coverage_image_0:tavily_raw->0->>image,coverage_image_1:tavily_raw->1->>image,coverage_image_2:tavily_raw->2->>image,coverage_image_3:tavily_raw->3->>image,coverage_image_4:tavily_raw->4->>image,coverage_image_5:tavily_raw->5->>image,coverage_image_6:tavily_raw->6->>image,coverage_image_7:tavily_raw->7->>image'

function stringArg(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function numberArg(name, fallback) {
  const value = Number(stringArg(name) ?? fallback)
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new Error(`--${name} must be an integer between 1 and 10000`)
  }
  return value
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function toFeedItem(row, userTopics) {
  const matchedTopics = Array.isArray(row.matched_topics) ? row.matched_topics : []
  const projectedCoverage = Array.isArray(row.coverage_images)
    ? row.coverage_images
    : Array.from({ length: 8 }, (_, index) => row[`coverage_image_${index}`])
  const coverageImages = projectedCoverage
    .filter((value) => typeof value === 'string' && value)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 4)

  return {
    id: row.id,
    topic: row.topic,
    displayTopic: userTopics.find((topic) => matchedTopics.includes(topic)) ?? row.topic,
    title: row.title,
    summary: row.summary,
    sources: Array.isArray(row.sources) ? row.sources : [],
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(coverageImages.length > 0 ? { coverageImages } : {}),
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
  }
}

async function selectBenchmarkUser(db, explicitUserId) {
  if (explicitUserId) {
    const { data, error } = await db.from('user_topics').select('topic').eq('user_id', explicitUserId)
    if (error) throw error
    return { userId: explicitUserId, topics: (data ?? []).map((row) => row.topic) }
  }

  const { data, error } = await db.from('user_topics').select('user_id,topic').limit(10_000)
  if (error) throw error
  const grouped = new Map()
  for (const row of data ?? []) {
    const topics = grouped.get(row.user_id) ?? []
    topics.push(row.topic)
    grouped.set(row.user_id, topics)
  }
  const selected = [...grouped.entries()].sort((left, right) => right[1].length - left[1].length)[0]
  if (!selected) throw new Error('No user with feed topics was found')
  return { userId: selected[0], topics: selected[1] }
}

async function loadBlockedTopics(db, userId, userTopics) {
  const followed = new Set(userTopics.map((topic) => String(topic).toLowerCase().trim()))
  const [excluded, learned] = await Promise.all([
    db.from('user_excluded_topics').select('topic').eq('user_id', userId),
    db.from('user_negative_topics').select('topic').eq('user_id', userId).gte('dislike_count', 2),
  ])
  if (excluded.error) throw excluded.error
  if (learned.error) throw learned.error

  return [...new Set([...(excluded.data ?? []), ...(learned.data ?? [])]
    .map((row) => String(row.topic ?? '').toLowerCase().trim())
    .filter((topic) => topic && !followed.has(topic)))]
}

async function main() {
  const maxItems = numberArg('max', 1000)
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
  const { userId, topics } = await selectBenchmarkUser(db, stringArg('user-id'))
  if (topics.length === 0) throw new Error('The selected user has no feed topics')
  const excludedTopics = await loadBlockedTopics(db, userId, topics)

  const oldStartedAt = performance.now()
  const oldResult = await db
    .rpc('get_personalized_feed', {
      p_user_id: userId,
      p_topics: topics,
      p_days: 0,
      p_excluded_topics: excludedTopics,
    })
    .select(FEED_SELECT)
    .limit(maxItems)
  const oldDurationMs = performance.now() - oldStartedAt
  if (oldResult.error) throw oldResult.error

  const snapshotAt = new Date().toISOString()
  const v2Rows = []
  const pageMetrics = []
  let cursorRank = null
  let cursorSortAt = null
  let cursorId = null
  let likedKeywords = null
  let hasMore = true

  while (hasMore && v2Rows.length < maxItems) {
    const startedAt = performance.now()
    const result = await db.rpc('get_personalized_feed_page_v2', {
      p_user_id: userId,
      p_topics: topics,
      p_days: 0,
      p_excluded_topics: excludedTopics,
      p_snapshot_at: snapshotAt,
      p_cursor_rank: cursorRank,
      p_cursor_sort_at: cursorSortAt,
      p_cursor_id: cursorId,
      p_limit: PAGE_QUERY_SIZE,
      p_liked_keywords: likedKeywords,
    })
    const durationMs = performance.now() - startedAt
    if (result.error) throw result.error

    const candidates = result.data ?? []
    const page = candidates.slice(0, Math.min(PAGE_SIZE, maxItems - v2Rows.length))
    if (likedKeywords === null) likedKeywords = candidates[0]?.feed_liked_keywords ?? []
    v2Rows.push(...page)
    pageMetrics.push({
      page: pageMetrics.length + 1,
      items: page.length,
      candidates: candidates.length,
      durationMs: Number(durationMs.toFixed(1)),
      bytes: byteLength(candidates),
    })

    hasMore = candidates.length > PAGE_SIZE && v2Rows.length < maxItems
    const last = page.at(-1)
    if (!hasMore || !last) break
    cursorRank = last.feed_rank
    cursorSortAt = last.feed_sort_at
    cursorId = last.id
  }

  const ids = v2Rows.map((row) => row.id)
  const uniqueIds = new Set(ids)
  const firstPage = pageMetrics[0]
  const oldRows = oldResult.data ?? []
  const oldItems = oldRows.map((row) => toFeedItem(row, topics))
  const v2Items = v2Rows.map((row) => toFeedItem(row, topics))
  const oldIds = new Set(oldRows.map((row) => row.id))
  const missingFromV2 = [...oldIds].filter((id) => !uniqueIds.has(id))
  const unexpectedInV2 = [...uniqueIds].filter((id) => !oldIds.has(id))

  console.log(JSON.stringify({
    readOnly: true,
    pageSize: PAGE_SIZE,
    dataset: { topics: topics.length, excludedTopics: excludedTopics.length },
    old: {
      items: oldRows.length,
      durationMs: Number(oldDurationMs.toFixed(1)),
      supabaseToServerBytes: byteLength(oldRows),
      serverToBrowserItemBytes: byteLength(oldItems),
    },
    v2: {
      items: v2Rows.length,
      pages: pageMetrics.length,
      duplicates: ids.length - uniqueIds.size,
      missingComparedWithV1: missingFromV2.length,
      unexpectedComparedWithV1: unexpectedInV2.length,
      totalDurationMs: Number(pageMetrics.reduce((total, page) => total + page.durationMs, 0).toFixed(1)),
      totalSupabaseToServerBytes: pageMetrics.reduce((total, page) => total + page.bytes, 0),
      totalServerToBrowserItemBytes: byteLength(v2Items),
      firstPageServerToBrowserItemBytes: byteLength(v2Items.slice(0, PAGE_SIZE)),
      firstPage,
    },
    pages: pageMetrics,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error
    ? error.message
    : JSON.stringify({
        message: error?.message ?? String(error),
        code: error?.code ?? null,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      }, null, 2))
  process.exitCode = 1
})
