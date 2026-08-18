import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const PAGE_SIZE = 10
const PAGE_QUERY_SIZE = PAGE_SIZE + 1
const FEED_SELECT = 'id,topic,title,summary,sources,image_url,published_at,cached_at,matched_topics,coverage_image_0:tavily_raw->0->>image,coverage_image_1:tavily_raw->1->>image,coverage_image_2:tavily_raw->2->>image,coverage_image_3:tavily_raw->3->>image,coverage_image_4:tavily_raw->4->>image,coverage_image_5:tavily_raw->5->>image,coverage_image_6:tavily_raw->6->>image,coverage_image_7:tavily_raw->7->>image'
const DIAGNOSTIC_ARTICLE_SELECT = 'id,title,published_at,cached_at,matched_topics,keywords'

function stringArg(name) {
  const prefix = `--${name}=`
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function numberArg(name, fallback) {
  const value = Number(stringArg(name) ?? fallback)
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new Error(`--${name} must be an integer between 1 and 100000`)
  }
  return value
}

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []
}

function effectiveTimestamp(row) {
  return row.published_at ?? row.cached_at ?? null
}

function timestampValue(value, fallback = Number.NEGATIVE_INFINITY) {
  if (!value) return fallback
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rankFor(row, likedKeywords) {
  const keywords = asStringArray(row.keywords)
  return keywords.some((keyword) => likedKeywords.has(keyword)) ? 0 : 1
}

function compareRanked(left, right) {
  if (left.feed_rank !== right.feed_rank) return left.feed_rank - right.feed_rank
  const timeDifference = timestampValue(right.feed_sort_at) - timestampValue(left.feed_sort_at)
  if (timeDifference !== 0) return timeDifference
  if (left.id === right.id) return 0
  return left.id < right.id ? 1 : -1
}

function decorateRanked(row, likedKeywords) {
  return {
    ...row,
    feed_rank: rankFor(row, likedKeywords),
    feed_sort_at: effectiveTimestamp(row),
  }
}

function sameStringSet(left, right) {
  if (left.size !== right.size) return false
  return [...left].every((value) => right.has(value))
}

function positions(rows) {
  return new Map(rows.map((row, index) => [row.id, index + 1]))
}

function difference(leftRows, rightRows) {
  const rightIds = new Set(rightRows.map((row) => row.id))
  return leftRows.filter((row) => !rightIds.has(row.id)).map((row) => row.id)
}

function boundaryKey(row) {
  return `${row?.feed_rank ?? 'null'}|${row?.feed_sort_at ?? 'null'}`
}

function reactionKey(row) {
  return `${row.article_id}|${row.reaction}|${row.created_at ?? ''}`
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

async function normalizeTopics(db, topics) {
  const normalized = []
  for (const topic of topics) {
    const { data, error } = await db.rpc('normalize_topic', { p_topic: topic })
    if (error) throw error
    const value = String(data ?? topic).trim()
    if (value) normalized.push(value)
  }
  return [...new Set(normalized)]
}

async function loadReactions(db, userId) {
  const { data, error } = await db
    .from('user_reactions')
    .select('article_id,reaction,created_at')
    .eq('user_id', userId)
    .limit(10_000)
  if (error) throw error
  return data ?? []
}

async function loadKeywordsForArticles(db, articleIds) {
  const keywords = new Set()
  const uniqueIds = [...new Set(articleIds)]
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const { data, error } = await db
      .from('articles')
      .select('id,keywords')
      .in('id', uniqueIds.slice(offset, offset + 200))
    if (error) throw error
    for (const row of data ?? []) {
      for (const keyword of asStringArray(row.keywords)) keywords.add(keyword)
    }
  }
  return keywords
}

async function loadDiagnosticArticles(db, normalizedTopics, limit) {
  const rows = []
  const pageSize = 1000
  for (let offset = 0; offset < limit; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, limit - 1)
    const { data, error } = await db
      .from('articles')
      .select(DIAGNOSTIC_ARTICLE_SELECT)
      .overlaps('matched_topics', normalizedTopics)
      .order('id', { ascending: true })
      .range(offset, end)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < end - offset + 1) break
  }
  return rows
}

function passesCommonFilters(row, topicSet, excludedSet, dislikedIds) {
  const matchedTopics = asStringArray(row.matched_topics)
  return matchedTopics.some((topic) => topicSet.has(topic))
    && !matchedTopics.some((topic) => excludedSet.has(topic))
    && !dislikedIds.has(row.id)
}

function buildDeterministicResults({
  articles,
  topicSet,
  excludedSet,
  dislikedIds,
  likedKeywords,
  snapshotAt,
  v2SnapshotFilters,
  requireEffectiveTimestamp = false,
}) {
  const snapshotTime = timestampValue(snapshotAt)
  return articles
    .filter((row) => {
      if (!passesCommonFilters(row, topicSet, excludedSet, dislikedIds)) return false
      const effective = effectiveTimestamp(row)
      if (requireEffectiveTimestamp && effective === null) return false
      if (!v2SnapshotFilters) return effective !== null
      const effectiveTime = timestampValue(effective)
      const cachedOrPublishedTime = timestampValue(row.cached_at ?? row.published_at)
      return effectiveTime <= snapshotTime && cachedOrPublishedTime <= snapshotTime
    })
    .map((row) => decorateRanked(row, likedKeywords))
    .sort(compareRanked)
}

function summarizeBoundary(rows, detailById, likedKeywords, startAt) {
  return rows.slice(startAt).map((row, index) => {
    const detail = detailById.get(row.id) ?? row
    const ranked = decorateRanked(detail, likedKeywords)
    return {
      position: startAt + index + 1,
      id: row.id,
      title: row.title,
      feed_rank: row.feed_rank ?? ranked.feed_rank,
      feed_sort_at: row.feed_sort_at ?? ranked.feed_sort_at,
      published_at: row.published_at,
      cached_at: row.cached_at,
    }
  })
}

function matchedRankingKeywords(row, likedKeywords) {
  return asStringArray(row?.keywords).filter((keyword) => likedKeywords.has(keyword))
}

function summarizeComparison(leftRows, rightRows) {
  return {
    leftOnly: difference(leftRows, rightRows),
    rightOnly: difference(rightRows, leftRows),
  }
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
  const [normalizedTopics, normalizedExcludedTopics] = await Promise.all([
    normalizeTopics(db, topics),
    normalizeTopics(db, excludedTopics),
  ])

  // Capture one comparison boundary before either feed query. V1 cannot consume
  // this timestamp, so the diagnostic reconstruction below applies it explicitly.
  const snapshotAt = new Date().toISOString()
  const reactionsBefore = await loadReactions(db, userId)
  const v1StartedAt = new Date().toISOString()

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
  const v1CompletedAt = new Date().toISOString()
  if (oldResult.error) throw oldResult.error

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

  const v2CompletedAt = new Date().toISOString()
  const reactionsAfter = await loadReactions(db, userId)
  const diagnosticLimit = numberArg('diagnostic-limit', 50_000)
  const diagnosticArticles = await loadDiagnosticArticles(db, normalizedTopics, diagnosticLimit)
  const diagnosticTruncated = diagnosticArticles.length === diagnosticLimit
  const detailById = new Map(diagnosticArticles.map((row) => [row.id, row]))

  const v1LikeCutoff = timestampValue(v1StartedAt) - (48 * 60 * 60 * 1000)
  const v1LikedArticleIds = reactionsBefore
    .filter((row) => row.reaction === 'like'
      && timestampValue(row.created_at) >= v1LikeCutoff)
    .map((row) => row.article_id)
  const v1LikedKeywords = await loadKeywordsForArticles(db, v1LikedArticleIds)
  const v2LikedKeywords = new Set(asStringArray(likedKeywords))
  const v1DislikedIds = new Set(reactionsBefore
    .filter((row) => row.reaction === 'dislike')
    .map((row) => row.article_id))
  const v2DislikedIds = new Set(reactionsAfter
    .filter((row) => row.reaction === 'dislike'
      && timestampValue(row.created_at) <= timestampValue(snapshotAt))
    .map((row) => row.article_id))
  const topicSet = new Set(normalizedTopics)
  const excludedSet = new Set(normalizedExcludedTopics)

  // These reconstructions are diagnostic only. They leave both RPCs unchanged:
  // - V1 deterministic: V1 filters/ranking plus V2's id DESC tie-break.
  // - V1 frozen: the same result constrained to the shared pre-query snapshot.
  // - V2 diagnostic: V2 filters/ranking reconstructed from projected columns.
  const v1DeterministicAll = buildDeterministicResults({
    articles: diagnosticArticles,
    topicSet,
    excludedSet,
    dislikedIds: v1DislikedIds,
    likedKeywords: v1LikedKeywords,
    snapshotAt,
    v2SnapshotFilters: false,
    requireEffectiveTimestamp: true,
  })
  const v1FrozenDeterministicAll = buildDeterministicResults({
    articles: diagnosticArticles,
    topicSet,
    excludedSet,
    dislikedIds: v1DislikedIds,
    likedKeywords: v1LikedKeywords,
    snapshotAt,
    v2SnapshotFilters: true,
    requireEffectiveTimestamp: true,
  })
  const v2DiagnosticAll = buildDeterministicResults({
    articles: diagnosticArticles,
    topicSet,
    excludedSet,
    dislikedIds: v2DislikedIds,
    likedKeywords: v2LikedKeywords,
    snapshotAt,
    v2SnapshotFilters: true,
    requireEffectiveTimestamp: false,
  })

  const ids = v2Rows.map((row) => row.id)
  const uniqueIds = new Set(ids)
  const firstPage = pageMetrics[0]
  const oldCandidates = oldResult.data ?? []
  const oldRows = oldCandidates.slice(0, maxItems)
  const oldItems = oldRows.map((row) => toFeedItem(row, topics))
  const v2Items = v2Rows.map((row) => toFeedItem(row, topics))
  const rawComparison = summarizeComparison(oldRows, v2Rows)
  const v1Deterministic = v1DeterministicAll.slice(0, maxItems)
  const v1FrozenDeterministic = v1FrozenDeterministicAll.slice(0, maxItems)
  const v2Diagnostic = v2DiagnosticAll.slice(0, maxItems)
  const deterministicComparison = summarizeComparison(v1Deterministic, v2Rows)
  const frozenComparison = summarizeComparison(v1FrozenDeterministic, v2Rows)
  const v2ReconstructionComparison = summarizeComparison(v2Diagnostic, v2Rows)

  const oldPositions = positions(oldCandidates)
  const v2Positions = positions(v2Rows)
  const v1DeterministicPositions = positions(v1DeterministicAll)
  const v1FrozenPositions = positions(v1FrozenDeterministicAll)
  const v2DiagnosticPositions = positions(v2DiagnosticAll)
  const oldBoundaryDetail = detailById.get(oldRows.at(-1)?.id)
  const oldBoundary = oldBoundaryDetail
    ? decorateRanked(oldBoundaryDetail, v1LikedKeywords)
    : null
  const v2Boundary = v2Rows.at(-1) ?? null
  const oldBoundaryKey = boundaryKey(oldBoundary)
  const v2BoundaryKey = boundaryKey(v2Boundary)
  const v1BoundaryTieCount = oldBoundary
    ? v1DeterministicAll.filter((row) => boundaryKey(row) === oldBoundaryKey).length
    : 0
  const v2BoundaryTieCount = v2Boundary
    ? v2DiagnosticAll.filter((row) => boundaryKey(row) === v2BoundaryKey).length
    : 0

  const divergentIds = [...new Set([...rawComparison.leftOnly, ...rawComparison.rightOnly])]
  const divergenceDetails = divergentIds.map((id) => {
    const detail = detailById.get(id)
      ?? oldCandidates.find((row) => row.id === id)
      ?? v2Rows.find((row) => row.id === id)
    const actualV2 = v2Rows.find((row) => row.id === id)
    const rankedV1 = detail ? decorateRanked(detail, v1LikedKeywords) : null
    const rankedV2 = detail ? decorateRanked(detail, v2LikedKeywords) : actualV2
    const effective = effectiveTimestamp(detail ?? {})
    const hasNullEffectiveDate = effective === null
    const afterSnapshot = timestampValue(effective) > timestampValue(snapshotAt)
      || timestampValue(detail?.cached_at ?? detail?.published_at) > timestampValue(snapshotAt)
    const tiedAtV1Boundary = rankedV1 !== null && boundaryKey(rankedV1) === oldBoundaryKey
    const tiedAtV2Boundary = rankedV2 !== null && boundaryKey(rankedV2) === v2BoundaryKey
    const inV1DeterministicTop = (v1DeterministicPositions.get(id) ?? Infinity) <= maxItems
    const inV1FrozenTop = (v1FrozenPositions.get(id) ?? Infinity) <= maxItems
    const inV2DiagnosticTop = (v2DiagnosticPositions.get(id) ?? Infinity) <= maxItems
    let reason = 'unresolved: filter or ranking difference requires database-side inspection'

    if (hasNullEffectiveDate) {
      reason = rawComparison.rightOnly.includes(id)
        ? 'V2 includes the article with feed_sort_at=-infinity; V1 excludes it because COALESCE(published_at,cached_at) >= -infinity evaluates to NULL.'
        : 'The article has no effective timestamp and should not be present in V1; inspect source row/RPC projection.'
    } else if (afterSnapshot) {
      reason = rawComparison.leftOnly.includes(id)
        ? 'V1 read the article after the shared snapshot boundary; V2 correctly excludes it from the frozen window.'
        : 'Timestamp is after the snapshot but the item appeared in V2; inspect timestamp precision/filtering.'
    } else if (frozenComparison.leftOnly.length === 0 && frozenComparison.rightOnly.length === 0
      && (tiedAtV1Boundary || tiedAtV2Boundary)) {
      reason = 'Boundary tie: V1 has no id DESC tie-break; deterministic V1 with the shared snapshot matches V2.'
    } else if (inV1FrozenTop === inV2DiagnosticTop && (tiedAtV1Boundary || tiedAtV2Boundary)) {
      reason = 'Boundary tie in raw V1 ordering; the deterministic diagnostic places the item consistently with V2.'
    } else if (v1LikedKeywords.size !== v2LikedKeywords.size
      || !sameStringSet(v1LikedKeywords, v2LikedKeywords)) {
      reason = 'Ranking inputs differ between reads: recent-like keyword sets are not identical.'
    } else if (inV1DeterministicTop !== inV1FrozenTop) {
      reason = 'Shared snapshot changes this item’s top-N membership.'
    } else if (inV1FrozenTop !== inV2DiagnosticTop) {
      reason = 'Real V1/V2 filter-semantic difference in the diagnostic reconstruction.'
    }

    return {
      side: rawComparison.leftOnly.includes(id) ? 'V1_ONLY' : 'V2_ONLY',
      id,
      title: detail?.title ?? null,
      feed_rank_v2: actualV2?.feed_rank ?? rankedV2?.feed_rank ?? null,
      feed_sort_at_v2: actualV2?.feed_sort_at ?? rankedV2?.feed_sort_at ?? null,
      published_at: detail?.published_at ?? null,
      cached_at: detail?.cached_at ?? null,
      matched_topics: asStringArray(detail?.matched_topics),
      v1_position_observed: oldPositions.get(id) ?? null,
      v1_position_approx: oldPositions.get(id) ?? v1DeterministicPositions.get(id) ?? null,
      v2_position: v2Positions.get(id) ?? null,
      v1_deterministic_position: v1DeterministicPositions.get(id) ?? null,
      v1_frozen_deterministic_position: v1FrozenPositions.get(id) ?? null,
      v2_diagnostic_position: v2DiagnosticPositions.get(id) ?? null,
      keywords: asStringArray(detail?.keywords),
      ranking_keyword_matches_v1: matchedRankingKeywords(detail, v1LikedKeywords),
      ranking_keyword_matches_v2: matchedRankingKeywords(detail, v2LikedKeywords),
      tied_at_v1_boundary: tiedAtV1Boundary,
      tied_at_v2_boundary: tiedAtV2Boundary,
      reason,
    }
  })

  const reactionsBeforeKeys = new Set(reactionsBefore.map(reactionKey))
  const reactionsAfterKeys = new Set(reactionsAfter.map(reactionKey))
  const v1RowsAfterSnapshot = oldRows.filter((row) =>
    timestampValue(row.published_at ?? row.cached_at) > timestampValue(snapshotAt)
    || timestampValue(row.cached_at ?? row.published_at) > timestampValue(snapshotAt))

  console.log(JSON.stringify({
    readOnly: true,
    pageSize: PAGE_SIZE,
    dataset: {
      userId,
      topics: topics.length,
      normalizedTopics,
      excludedTopics: excludedTopics.length,
      normalizedExcludedTopics,
      diagnosticArticles: diagnosticArticles.length,
      diagnosticLimit,
      diagnosticTruncated,
    },
    snapshot: {
      snapshotAt,
      capturedBeforeV1: timestampValue(snapshotAt) <= timestampValue(v1StartedAt),
      v1StartedAt,
      v1CompletedAt,
      v2CompletedAt,
      v1TopItemsAfterSnapshot: v1RowsAfterSnapshot.map((row) => ({
        id: row.id,
        title: row.title,
        published_at: row.published_at,
        cached_at: row.cached_at,
      })),
      reactionsChangedDuringBenchmark: !sameStringSet(reactionsBeforeKeys, reactionsAfterKeys),
      v1AndV2LikedKeywordsEqual: sameStringSet(v1LikedKeywords, v2LikedKeywords),
      v1LikedKeywords: [...v1LikedKeywords].sort(),
      v2LikedKeywords: [...v2LikedKeywords].sort(),
      limitation: 'articles has no created_at/updated_at; snapshot interference is inferred from published_at/cached_at plus reaction-state comparison.',
    },
    old: {
      items: oldRows.length,
      diagnosticCandidates: oldCandidates.length,
      durationMs: Number(oldDurationMs.toFixed(1)),
      supabaseToServerBytes: byteLength(oldRows),
      serverToBrowserItemBytes: byteLength(oldItems),
    },
    v2: {
      items: v2Rows.length,
      pages: pageMetrics.length,
      duplicates: ids.length - uniqueIds.size,
      missingComparedWithV1: rawComparison.leftOnly.length,
      unexpectedComparedWithV1: rawComparison.rightOnly.length,
      totalDurationMs: Number(pageMetrics.reduce((total, page) => total + page.durationMs, 0).toFixed(1)),
      totalSupabaseToServerBytes: pageMetrics.reduce((total, page) => total + page.bytes, 0),
      totalServerToBrowserItemBytes: byteLength(v2Items),
      firstPageServerToBrowserItemBytes: byteLength(v2Items.slice(0, PAGE_SIZE)),
      firstPage,
    },
    divergence: {
      rawV1VsV2: rawComparison,
      items: divergenceDetails,
      boundary: {
        v1Key: oldBoundaryKey,
        v1TieGroupSize: v1BoundaryTieCount,
        v2Key: v2BoundaryKey,
        v2TieGroupSize: v2BoundaryTieCount,
        last10V1: summarizeBoundary(oldRows, detailById, v1LikedKeywords, Math.max(0, oldRows.length - 10)),
        last10V2: summarizeBoundary(v2Rows, detailById, v2LikedKeywords, Math.max(0, v2Rows.length - 10)),
      },
      comparisons: {
        v1DeterministicVsV2: deterministicComparison,
        v1FrozenDeterministicVsV2: frozenComparison,
        v2DiagnosticReconstructionVsV2: v2ReconstructionComparison,
      },
      interpretation: frozenComparison.leftOnly.length === 0 && frozenComparison.rightOnly.length === 0
        ? 'V1 with deterministic id DESC and the shared snapshot is set-equivalent to V2.'
        : 'A semantic or snapshot difference remains after deterministic ordering; inspect item reasons above.',
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
