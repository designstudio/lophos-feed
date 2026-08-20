/**
 * News cluster stage
 *
 * Consome o último preflight salvo no Supabase, carrega os raw_items aprovados
 * e monta clusters prontos para o provedor editorial configurado.
 */

import { createClient } from '@supabase/supabase-js'
import { clusterDeterministicItems } from './news-pipeline-core.mjs'
import {
  DEFAULT_V2_OPTIONS,
  clusterItemsV2WithRoles,
  composeEventText,
  embedEventTexts,
  loadLocalEmbeddingExtractor,
} from './news-cluster-v2-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const DEFAULT_SIMILARITY_THRESHOLD = 0.3
const DEFAULT_MIN_STRONG_TOKENS = 3
const RAW_ITEMS_BATCH_SIZE = 100
const CLUSTER_RUN_STATUS = process.env.NEWS_CLUSTER_RUN_STATUS || 'ready'
const CLUSTER_ALGORITHM = String(process.env.NEWS_CLUSTER_ALGORITHM || 'semantic-v2').trim().toLowerCase()
const CLUSTER_V2_MODEL = process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId
const CLUSTER_V2_THRESHOLD = Number(process.env.EMBEDDING_MERGE_THRESHOLD || DEFAULT_V2_OPTIONS.semanticThreshold)
const SOURCE_FILTER = String(process.env.NEWS_SOURCE_FILTER || '').trim()

const semanticV2Enabled = ['v2', 'semantic', 'semantic-v2'].includes(CLUSTER_ALGORITHM)
const deterministicV1Enabled = ['deterministic', 'v1', 'deterministic-v1'].includes(CLUSTER_ALGORITHM)
const requestedAlgorithmName = semanticV2Enabled ? 'semantic-v2-role-aware' : 'deterministic-v1'

if (!semanticV2Enabled && !deterministicV1Enabled) {
  throw new Error(`Unsupported NEWS_CLUSTER_ALGORITHM: ${CLUSTER_ALGORITHM}`)
}

function assertEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function flattenTopicIds(topics, key) {
  return unique((topics || []).flatMap((topic) => topic?.[key] || []))
}

function chooseClusterTopic(items) {
  const counts = new Map()
  for (const item of items || []) {
    const topic = String(item?.topic || '').trim().toLowerCase()
    if (!topic) continue
    counts.set(topic, (counts.get(topic) || 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'sem-topico'
}

async function clusterSemanticItems(items, { maxPairHours }) {
  const startedAt = performance.now()
  const extractor = await loadLocalEmbeddingExtractor(CLUSTER_V2_MODEL)
  const vectors = await embedEventTexts(extractor, items.map(composeEventText))
  const titleVectors = await embedEventTexts(extractor, items.map((item) => item.title || ''))
  const result = clusterItemsV2WithRoles(items, vectors, {
    semanticThreshold: CLUSTER_V2_THRESHOLD,
    titleVectors,
    maxPairHours,
  })
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const clusteredIds = new Set()
  const records = []

  for (const cluster of result.primaryClusters) {
    const ids = unique([
      ...cluster.ids,
      ...cluster.supporting.map((entry) => entry.item.id),
    ])
    ids.forEach((id) => clusteredIds.add(id))
    records.push({
      topic: chooseClusterTopic(cluster.items),
      ids,
      primaryIds: cluster.ids,
    })
  }

  for (const item of items) {
    if (clusteredIds.has(item.id)) continue
    clusteredIds.add(item.id)
    records.push({ topic: chooseClusterTopic([item]), ids: [item.id], primaryIds: [item.id] })
  }

  const grouped = new Map()
  for (const record of records) {
    const bucket = grouped.get(record.topic) || []
    bucket.push(record)
    grouped.set(record.topic, bucket)
  }

  return {
    grouped,
    itemsById,
    stats: {
      algorithm: 'semantic-v2-role-aware',
      model: CLUSTER_V2_MODEL,
      threshold: CLUSTER_V2_THRESHOLD,
      primaryEvents: result.eventClusters.length,
      supportingAttachments: result.eventClusters.reduce((sum, cluster) => sum + cluster.supporting.length, 0),
      pairChecks: result.pairChecks,
      durationMs: Math.round(performance.now() - startedAt),
    },
  }
}

async function fetchItemsByIds(db, ids) {
  const uniqueIds = unique(ids).filter((id) => typeof id === 'string' && id.trim().length > 0)
  if (uniqueIds.length === 0) return []

  const items = []

  for (let i = 0; i < uniqueIds.length; i += RAW_ITEMS_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + RAW_ITEMS_BATCH_SIZE)
    const { data, error } = await db
      .from('raw_items')
      .select('id, url, title, content, summary, image_url, video_url, topic, source_name, source_url, pub_date, fetched_at, dedup_hash')
      .in('id', batch)
      .eq('processed', false)

    if (error) {
      throw new Error(`Failed to load raw_items for cluster stage (batch ${Math.floor(i / RAW_ITEMS_BATCH_SIZE) + 1}/${Math.ceil(uniqueIds.length / RAW_ITEMS_BATCH_SIZE)}): ${error.message}`)
    }

    items.push(...(data || []))
  }

  const byId = new Map(items.map((item) => [item.id, item]))
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean)
}

async function main() {
  console.log(`[cluster] Algorithm: ${requestedAlgorithmName}`)

  const db = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const { data: latestPreflight, error: preflightError } = await db
    .from('news_preflight_runs')
    .select('id, window_hours, batch_size, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (preflightError) {
    throw new Error(`Could not load latest preflight run: ${preflightError.message}`)
  }

  if (!latestPreflight?.payload?.topics?.length) {
    console.log('No preflight payload found to cluster.')
    return
  }

  if (SOURCE_FILTER && latestPreflight.payload.sourceFilter?.toLocaleLowerCase('pt-BR') !== SOURCE_FILTER.toLocaleLowerCase('pt-BR')) {
    throw new Error(`Latest preflight run is not scoped to source: ${SOURCE_FILTER}`)
  }

  const { data: latestClusterRun, error: clusterRunError } = await db
    .from('news_cluster_runs')
    .select('id, preflight_run_id, status, payload, created_at')
    .eq('preflight_run_id', latestPreflight.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (clusterRunError) {
    throw new Error(`Could not inspect existing cluster runs: ${clusterRunError.message}`)
  }

  const matchingClusterRun = latestClusterRun?.find(
    (run) => run.payload?.clustering?.algorithm === requestedAlgorithmName,
  )
  if (matchingClusterRun) {
    console.log(
      `Cluster run ${requestedAlgorithmName} already exists for preflight ${latestPreflight.id}: ${matchingClusterRun.id} (${matchingClusterRun.status})`,
    )
    return
  }
  if (latestClusterRun?.length > 0) {
    const previousAlgorithms = unique(
      latestClusterRun.map((run) => run.payload?.clustering?.algorithm || 'unknown'),
    )
    console.log(
      `[cluster] Existing run(s) use ${previousAlgorithms.join(', ')}; creating ${requestedAlgorithmName} for the same preflight.`,
    )
  }
  const supersededRunIds = (latestClusterRun || [])
    .filter((run) => (
      run.status === CLUSTER_RUN_STATUS
      && run.payload?.clustering?.algorithm !== requestedAlgorithmName
    ))
    .map((run) => run.id)

  const topics = latestPreflight.payload.topics || []
  const acceptedIds = flattenTopicIds(topics, 'acceptedIds')
  const acceptedForClusterIds = flattenTopicIds(topics, 'acceptedForClusterIds')
  const hasAcceptedForClusterField = topics.some((topic) => Array.isArray(topic?.acceptedForClusterIds))
  const rejectedRawIds = unique([
    ...(latestPreflight.payload.rejectedRawIds || []),
    ...(latestPreflight.payload.duplicateRawIds || []),
    ...flattenTopicIds(topics, 'rejectedIds'),
    ...flattenTopicIds(topics, 'duplicateIds'),
  ])
  const semanticDuplicateRawIds = unique([
    ...(latestPreflight.payload.semanticDuplicateRawIds || []),
    ...flattenTopicIds(topics, 'semanticDuplicateIds'),
  ])

  const acceptedItems = await fetchItemsByIds(db, hasAcceptedForClusterField ? acceptedForClusterIds : acceptedIds)
  const acceptedItemsByTopic = new Map()

  for (const item of acceptedItems) {
    const bucket = acceptedItemsByTopic.get(item.topic) || []
    bucket.push(item)
    acceptedItemsByTopic.set(item.topic, bucket)
  }

  let semanticResult = null
  if (semanticV2Enabled && acceptedItems.length > 0) {
    console.log(`[cluster] Loading semantic V2 (${CLUSTER_V2_MODEL}) for ${acceptedItems.length} items...`)
    semanticResult = await clusterSemanticItems(acceptedItems, {
      maxPairHours: Math.min(Number(latestPreflight.window_hours || 12), DEFAULT_V2_OPTIONS.maxPairHours),
    })
    console.log(
      `[cluster] V2 ready: events=${semanticResult.stats.primaryEvents} supporting=${semanticResult.stats.supportingAttachments} duration=${(semanticResult.stats.durationMs / 1000).toFixed(2)}s`,
    )
  }

  const topicPayloads = []
  const totalAcceptedIds = new Set()
  let totalClusters = 0

  const topicReportsByName = new Map(topics.map((topicReport) => [topicReport.topic, topicReport]))
  const topicNames = semanticResult
    ? unique([...topics.map((topicReport) => topicReport.topic), ...semanticResult.grouped.keys()])
    : topics.map((topicReport) => topicReport.topic)

  for (const topicName of topicNames) {
    const topicReport = topicReportsByName.get(topicName) || { topic: topicName }
    const semanticRecords = semanticResult?.grouped.get(topicName) || []
    const clusters = semanticResult
      ? semanticRecords.map((record) => record.ids)
      : clusterDeterministicItems(acceptedItemsByTopic.get(topicName) || [], {
        similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
        minStrongTokens: DEFAULT_MIN_STRONG_TOKENS,
      })
    const topicItemIds = unique(clusters.flat())
    const topicItems = semanticResult
      ? topicItemIds.map((id) => semanticResult.itemsById.get(id)).filter(Boolean)
      : acceptedItemsByTopic.get(topicName) || []

    topicItemIds.forEach((id) => totalAcceptedIds.add(id))
    totalClusters += clusters.length

    topicPayloads.push({
      topic: topicName,
      acceptedItemIds: topicItemIds,
      acceptedItems: topicItems,
      clusters,
      acceptedForClusterIds: topicItemIds,
      semanticDuplicateIds: unique(topicReport.semanticDuplicateIds || []),
      rejectedRawIds: unique([
        ...(topicReport.rejectedIds || []),
        ...(topicReport.duplicateIds || []),
      ]),
    })

    const multiSourceClusters = clusters.filter((cluster) => cluster.length > 1).length
    console.log(`[${topicName}] accepted=${topicItemIds.length} clusters=${clusters.length} multi_source=${multiSourceClusters}`)
  }

  const totalAccepted = totalAcceptedIds.size

  const payload = {
    preflightRunId: latestPreflight.id,
    windowHours: latestPreflight.window_hours,
    historyHours: latestPreflight.payload.historyHours || 72,
    batchSize: latestPreflight.batch_size,
    sourceFilter: latestPreflight.payload.sourceFilter || null,
    rejectedRawIds,
    semanticDuplicateRawIds,
    semanticMatches: latestPreflight.payload.semanticMatches || [],
    clustering: semanticResult?.stats || (semanticV2Enabled
      ? {
          algorithm: 'semantic-v2-role-aware',
          model: CLUSTER_V2_MODEL,
          threshold: CLUSTER_V2_THRESHOLD,
          primaryEvents: 0,
          supportingAttachments: 0,
          pairChecks: 0,
          durationMs: 0,
        }
      : {
          algorithm: 'deterministic-v1',
          similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
          minStrongTokens: DEFAULT_MIN_STRONG_TOKENS,
        }),
    topics: topicPayloads,
  }

  const { data: insertedRow, error: insertError } = await db
    .from('news_cluster_runs')
    .insert({
      preflight_run_id: latestPreflight.id,
      window_hours: latestPreflight.window_hours,
      history_hours: latestPreflight.payload.historyHours || 72,
      batch_size: latestPreflight.batch_size,
      total_topics: topicPayloads.length,
      total_accepted: totalAccepted,
      total_clusters: totalClusters,
      total_rejected: rejectedRawIds.length,
      payload,
      status: CLUSTER_RUN_STATUS,
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    throw new Error(`Failed to save cluster run: ${insertError.message}`)
  }

  if (supersededRunIds.length > 0) {
    const { error: supersedeError } = await db
      .from('news_cluster_runs')
      .update({ status: 'superseded' })
      .in('id', supersededRunIds)

    if (supersedeError) {
      console.warn(`[cluster] Could not supersede previous ${CLUSTER_RUN_STATUS} run(s): ${supersedeError.message}`)
    } else {
      console.log(`[cluster] Superseded ${supersededRunIds.length} previous ${CLUSTER_RUN_STATUS} run(s).`)
    }
  }

  console.log(`\nCluster run salvo em news_cluster_runs: ${insertedRow.id} (${insertedRow.created_at}) [${CLUSTER_RUN_STATUS}]`)
  console.log(
    `Resumo: topics=${topicPayloads.length}, accepted=${totalAccepted}, clusters=${totalClusters}, rejected=${rejectedRawIds.length}, semantic_duplicates=${semanticDuplicateRawIds.length}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
