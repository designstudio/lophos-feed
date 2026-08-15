/**
 * Read-only Clustering V2 shadow runner.
 *
 * Reads recent raw_items, compares V1 and role-aware V2 in memory, and appends
 * one audit record to logs/news-cluster-v2-shadow.jsonl. It performs no writes
 * to Supabase and does not invoke any editorial/generative model.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { clusterDeterministicItems, preflightRawItems } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'
import {
  DEFAULT_V2_OPTIONS,
  SOURCE_ROLES,
  clusterItemsV2WithRoles,
  composeEventText,
  embedEventTexts,
  loadLocalEmbeddingExtractor,
} from './news-cluster-v2-core.mjs'

loadScriptEnvironment()

const SHADOW_SCHEMA_VERSION = 1
const SHADOW_ALGORITHM_VERSION = 'v2-role-aware-shadow-1'
const LOG_PATH = path.resolve(process.cwd(), 'logs', 'news-cluster-v2-shadow.jsonl')

function argNumber(name, fallback, { integer = false } = {}) {
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))
  const value = inline ? Number(inline.slice(inline.indexOf('=') + 1)) : fallback
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new Error(`--${name} must be a positive ${integer ? 'integer' : 'number'}`)
  }
  return value
}

function argString(name, fallback) {
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))
  return inline ? inline.slice(inline.indexOf('=') + 1) : fallback
}

function appendReport(report) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true })
  fs.appendFileSync(LOG_PATH, `${JSON.stringify(report)}\n`, { encoding: 'utf8', flag: 'a' })
}

async function loadRecentItems(db, since, until, limit) {
  const rows = []
  const pageSize = 1000
  for (let offset = 0; rows.length < limit; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, offset + (limit - rows.length) - 1)
    const { data, error } = await db.from('raw_items')
      .select('id, url, title, summary, content, topic, source_name, source_url, pub_date, fetched_at, processed')
      .gte('pub_date', since)
      .lte('pub_date', until)
      .order('pub_date', { ascending: false })
      .range(offset, end)
    if (error) throw new Error(`Read-only raw_items query failed: ${error.message}`)
    rows.push(...(data || []))
    if (!data?.length || data.length < end - offset + 1) break
  }
  return rows
}

function v1AcrossTopics(items) {
  const byTopic = new Map()
  for (const item of items) {
    const topic = item.topic || 'sem-topico'
    const bucket = byTopic.get(topic) || []
    bucket.push(item)
    byTopic.set(topic, bucket)
  }
  return [...byTopic.values()].flatMap((topicItems) => clusterDeterministicItems(topicItems))
}

function clusterStats(clusters) {
  const sizes = clusters.map((cluster) => Array.isArray(cluster) ? cluster.length : cluster.ids.length)
  const distribution = {}
  for (const size of sizes) distribution[size] = (distribution[size] || 0) + 1
  return {
    clusters: sizes.length,
    singletons: sizes.filter((size) => size === 1).length,
    pairs: sizes.filter((size) => size === 2).length,
    threePlus: sizes.filter((size) => size >= 3).length,
    averageSources: sizes.length ? Number((sizes.reduce((sum, size) => sum + size, 0) / sizes.length).toFixed(4)) : 0,
    distribution,
  }
}

function clusterIndex(clusters) {
  const result = new Map()
  clusters.forEach((cluster, index) => {
    const ids = Array.isArray(cluster) ? cluster : cluster.ids
    ids.forEach((id) => result.set(id, index))
  })
  return result
}

function auditItem(item) {
  return {
    title: item.title || '',
    sourceName: item.source_name || null,
    topic: item.topic || null,
    language: item.language || item.lang || null,
    pubDate: item.pub_date || null,
  }
}

function diffReport(items, v1, primaryClusters) {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const v1Index = clusterIndex(v1)
  const v2Index = clusterIndex(primaryClusters)
  const v2JoinedV1Separated = primaryClusters
    .filter((cluster) => cluster.ids.length > 1 && new Set(cluster.ids.map((id) => v1Index.get(id))).size > 1)
    .map((cluster) => cluster.items.map(auditItem))
  const v1JoinedV2Separated = v1
    .filter((cluster) => cluster.length > 1 && new Set(cluster.map((id) => v2Index.get(id) ?? `non-primary:${id}`)).size > 1)
    .map((cluster) => cluster.map((id) => auditItem(itemsById.get(id) || { title: String(id) })))
  return { v2JoinedV1Separated, v1JoinedV2Separated }
}

function primaryNearMisses(items, v2, limit) {
  const primaryIds = new Set(v2.sourceProfiles
    .map((profile, index) => profile.role === SOURCE_ROLES.PRIMARY ? items[index].id : null)
    .filter(Boolean))
  const itemCluster = clusterIndex(v2.primaryClusters)
  return [...v2.pairDecisions.entries()]
    .map(([key, decision]) => {
      const [leftIndex, rightIndex] = key.split(':').map(Number)
      return { key, leftIndex, rightIndex, left: items[leftIndex], right: items[rightIndex], decision }
    })
    .filter(({ left, right }) => primaryIds.has(left.id) && primaryIds.has(right.id))
    .filter(({ left, right }) => (itemCluster.get(left.id) ?? `item:${left.id}`) !== (itemCluster.get(right.id) ?? `item:${right.id}`))
    .filter(({ decision }) => decision.semanticScore >= 0.80)
    .filter(({ decision }) => decision.hoursApart === null || decision.hoursApart <= v2.options.maxPairHours)
    .filter(({ decision }) => !decision.sameSource)
    .filter(({ decision }) => decision.rareTokens.length >= 2 || decision.lexicalScore >= 0.08 || decision.sharedEventKinds.length > 0)
    .sort((left, right) => right.decision.semanticScore - left.decision.semanticScore)
    .slice(0, limit)
    .map(({ key, left, right, decision }) => {
      const clusterRejection = decision.merge
        ? (v2.primaryCandidatePairs.has(key) ? 'complete-link-rejection' : 'top-k-rejection')
        : decision.reason
      return {
        semanticScore: Number(decision.semanticScore.toFixed(6)),
        titleSemanticScore: decision.titleSemanticScore === null ? null : Number(decision.titleSemanticScore.toFixed(6)),
        lexicalScore: Number(decision.lexicalScore.toFixed(6)),
        rareTokens: decision.rareTokens,
        sharedTitleTokens: decision.sharedTitleTokens,
        leftEventTypes: decision.leftEventKinds,
        rightEventTypes: decision.rightEventKinds,
        blockers: [...decision.blockers, ...(decision.merge ? [clusterRejection] : [])],
        rejectionReason: clusterRejection,
        hoursApart: decision.hoursApart === null ? null : Number(decision.hoursApart.toFixed(4)),
        left: auditItem(left),
        right: auditItem(right),
      }
    })
}

function eventReport(v2) {
  return v2.eventClusters.map((cluster, index) => ({
    eventNumber: index + 1,
    primary: cluster.items.map(auditItem),
    mergeEvidence: cluster.merges.map((merge) => ({
      semanticScore: Number(merge.semanticScore.toFixed(6)),
      titleSemanticScore: merge.titleSemanticScore === null ? null : Number(merge.titleSemanticScore.toFixed(6)),
      lexicalScore: Number(merge.lexicalScore.toFixed(6)),
      reason: merge.reason,
      rareTokens: merge.rareTokens,
      sharedNumbers: merge.sharedNumbers,
      sharedEventTypes: merge.sharedEventKinds,
    })),
    supporting: cluster.supporting.map(({ item, profile, relation }) => ({
      ...auditItem(item),
      kind: profile.kind,
      reason: relation.reason,
      semanticScore: Number(relation.semanticScore.toFixed(6)),
      lexicalScore: Number(relation.lexicalScore.toFixed(6)),
      sharedAnchors: relation.sharedAnchors,
      matchedPrimary: cluster.items.find((primary) => primary.id === relation.matchedPrimaryId)
        ? auditItem(cluster.items.find((primary) => primary.id === relation.matchedPrimaryId))
        : null,
    })),
  }))
}

async function main() {
  const startedAt = new Date()
  const totalStarted = performance.now()
  let stage = 'configuration'
  let window = null

  try {
    const hours = argNumber('hours', Number(process.env.NEWS_CLUSTER_V2_SHADOW_HOURS || 12))
    const limit = argNumber('limit', Number(process.env.NEWS_CLUSTER_V2_SHADOW_LIMIT || 2000), { integer: true })
    const nearMissLimit = argNumber('near-miss-limit', Number(process.env.NEWS_CLUSTER_V2_SHADOW_NEAR_MISS_LIMIT || 20), { integer: true })
    const semanticThreshold = Number(process.env.EMBEDDING_MERGE_THRESHOLD || DEFAULT_V2_OPTIONS.semanticThreshold)
    const maxPairHours = argNumber('max-pair-hours', Number(process.env.NEWS_CLUSTER_V2_SHADOW_MAX_PAIR_HOURS || Math.min(18, hours)))
    const topK = argNumber('top-k', Number(process.env.NEWS_CLUSTER_V2_SHADOW_TOP_K || DEFAULT_V2_OPTIONS.topK), { integer: true })
    const modelId = process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId
    const until = new Date(argString('end', new Date().toISOString()))
    if (!Number.isFinite(until.getTime())) throw new Error('--end must be a valid ISO date')
    const untilIso = until.toISOString()
    const since = new Date(until.getTime() - hours * 3_600_000).toISOString()
    window = { hours, since, until: untilIso }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment is not configured')
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    stage = 'read-raw-items'
    const queried = await loadRecentItems(db, since, untilIso, limit)
    stage = 'local-preflight'
    const { accepted, rejected, duplicateIds } = preflightRawItems(queried)
    const items = accepted
    const v1 = v1AcrossTopics(items)
    const rssBefore = process.memoryUsage().rss

    stage = 'model-load'
    const loadStarted = performance.now()
    const extractor = await loadLocalEmbeddingExtractor(modelId)
    const modelLoadMs = performance.now() - loadStarted

    stage = 'embeddings'
    const embeddingStarted = performance.now()
    const vectors = await embedEventTexts(extractor, items.map(composeEventText))
    const titleVectors = await embedEventTexts(extractor, items.map((item) => item.title || ''))
    const embeddingMs = performance.now() - embeddingStarted

    stage = 'clustering'
    const clusteringStarted = performance.now()
    const v2 = clusterItemsV2WithRoles(items, vectors, {
      semanticThreshold,
      maxPairHours,
      topK,
      titleVectors,
    })
    const clusteringMs = performance.now() - clusteringStarted
    const rssAfter = process.memoryUsage().rss
    const attachedSupportingIds = new Set(v2.eventClusters.flatMap((cluster) => cluster.supporting.map(({ item }) => item.id)))
    const diffs = diffReport(items, v1, v2.primaryClusters)

    const report = {
      schemaVersion: SHADOW_SCHEMA_VERSION,
      algorithmVersion: SHADOW_ALGORITHM_VERSION,
      status: 'success',
      timestamp: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      window,
      input: {
        rawItems: queried.length,
        acceptedItems: items.length,
        policyRejectedItems: rejected.length,
        exactDuplicatesInBatch: duplicateIds.length,
        queryLimit: limit,
      },
      v1: clusterStats(v1),
      v2Primary: clusterStats(v2.primaryClusters),
      supportingSources: {
        candidates: v2.supportingSources.length,
        attachedUnique: attachedSupportingIds.size,
        attachments: v2.eventClusters.reduce((sum, cluster) => sum + cluster.supporting.length, 0),
        unattached: v2.supportingSources.length - attachedSupportingIds.size,
      },
      primaryEvents: eventReport(v2),
      diff: diffs,
      nearMisses: primaryNearMisses(items, v2, nearMissLimit),
      performance: {
        modelLoadMs: Number(modelLoadMs.toFixed(3)),
        embeddingMs: Number(embeddingMs.toFixed(3)),
        clusteringMs: Number(clusteringMs.toFixed(3)),
        totalMs: Number((performance.now() - totalStarted).toFixed(3)),
        embeddingVectors: items.length * 2,
        embeddingVectorsPerSecond: embeddingMs > 0 ? Number(((items.length * 2) / (embeddingMs / 1000)).toFixed(3)) : null,
        pairChecks: v2.pairChecks,
        primaryCandidatePairs: v2.primaryCandidatePairs.size,
        rssBytes: { before: rssBefore, after: rssAfter, delta: rssAfter - rssBefore },
        rssMiB: {
          before: Number((rssBefore / 1048576).toFixed(3)),
          after: Number((rssAfter / 1048576).toFixed(3)),
          delta: Number(((rssAfter - rssBefore) / 1048576).toFixed(3)),
        },
      },
      config: {
        modelId,
        semanticThreshold: v2.options.semanticThreshold,
        highConfidenceThreshold: v2.options.highConfidenceThreshold,
        supportingSemanticThreshold: v2.options.supportingSemanticThreshold,
        minPrimarySourcesForSupporting: v2.options.minPrimarySourcesForSupporting,
        maxPairHours: v2.options.maxPairHours,
        topK: v2.options.topK,
        enableRecallSignals: v2.options.enableRecallSignals,
        nearMissLimit,
        representation: 'title+summary and title-only complement',
        linkage: 'complete-link-primary-only',
      },
    }

    stage = 'append-report'
    appendReport(report)
    console.log(`[news:cluster-v2-shadow] Appended success report to ${LOG_PATH}`)
    console.log(`[news:cluster-v2-shadow] raw=${queried.length} primary_clusters=${report.v2Primary.clusters} primary_events=${report.primaryEvents.length} supporting_attachments=${report.supportingSources.attachments} total=${(report.performance.totalMs / 1000).toFixed(2)}s`)
  } catch (error) {
    const failureReport = {
      schemaVersion: SHADOW_SCHEMA_VERSION,
      algorithmVersion: SHADOW_ALGORITHM_VERSION,
      status: 'error',
      timestamp: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      window,
      failedStage: stage,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
      },
      totalMs: Number((performance.now() - totalStarted).toFixed(3)),
    }
    try {
      appendReport(failureReport)
      console.error(`[news:cluster-v2-shadow] Appended error report to ${LOG_PATH}`)
    } catch (appendError) {
      console.error('[news:cluster-v2-shadow] Could not append error report:', appendError?.message || appendError)
    }
    throw error
  }
}

main().catch((error) => {
  console.error('[news:cluster-v2-shadow] Failed:', error?.message || error)
  process.exit(1)
})
