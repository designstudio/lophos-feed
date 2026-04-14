/**
 * News cluster stage
 *
 * Consome o último preflight salvo no Supabase, carrega os raw_items aprovados
 * e monta clusters determinísticos prontos para o Gemini.
 */

import { createClient } from '@supabase/supabase-js'
import { clusterDeterministicItems } from './news-pipeline-core.mjs'

const DEFAULT_SIMILARITY_THRESHOLD = 0.3
const DEFAULT_MIN_STRONG_TOKENS = 3

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

async function fetchItemsByIds(db, ids) {
  const uniqueIds = unique(ids)
  if (uniqueIds.length === 0) return []

  const { data, error } = await db
    .from('raw_items')
    .select('id, url, title, content, summary, image_url, video_url, topic, source_name, source_url, pub_date, fetched_at, dedup_hash')
    .in('id', uniqueIds)
    .eq('processed', false)

  if (error) {
    throw new Error(`Failed to load raw_items for cluster stage: ${error.message}`)
  }

  const byId = new Map((data || []).map((item) => [item.id, item]))
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean)
}

async function main() {
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

  const { data: latestClusterRun } = await db
    .from('news_cluster_runs')
    .select('id, preflight_run_id, status, created_at')
    .eq('preflight_run_id', latestPreflight.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (latestClusterRun?.length > 0) {
    const existing = latestClusterRun[0]
    console.log(`Cluster run already exists for preflight ${latestPreflight.id}: ${existing.id} (${existing.status})`)
    return
  }

  const topics = latestPreflight.payload.topics || []
  const acceptedIds = flattenTopicIds(topics, 'acceptedIds')
  const rejectedRawIds = unique([
    ...(latestPreflight.payload.rejectedRawIds || []),
    ...(latestPreflight.payload.duplicateRawIds || []),
    ...(latestPreflight.payload.semanticDuplicateRawIds || []),
    ...flattenTopicIds(topics, 'rejectedIds'),
    ...flattenTopicIds(topics, 'duplicateIds'),
    ...flattenTopicIds(topics, 'semanticDuplicateIds'),
  ])

  const acceptedItems = await fetchItemsByIds(db, acceptedIds)
  const acceptedItemsByTopic = new Map()

  for (const item of acceptedItems) {
    const bucket = acceptedItemsByTopic.get(item.topic) || []
    bucket.push(item)
    acceptedItemsByTopic.set(item.topic, bucket)
  }

  const topicPayloads = []
  let totalAccepted = 0
  let totalClusters = 0

  for (const topicReport of topics) {
    const topicItems = acceptedItemsByTopic.get(topicReport.topic) || []
    const clusters = clusterDeterministicItems(topicItems, {
      similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
      minStrongTokens: DEFAULT_MIN_STRONG_TOKENS,
    })

    totalAccepted += topicItems.length
    totalClusters += clusters.length

    topicPayloads.push({
      topic: topicReport.topic,
      acceptedItemIds: topicItems.map((item) => item.id),
      acceptedItems: topicItems,
      clusters,
      rejectedRawIds: unique([
        ...(topicReport.rejectedIds || []),
        ...(topicReport.duplicateIds || []),
        ...(topicReport.semanticDuplicateIds || []),
      ]),
    })

    console.log(`[${topicReport.topic}] accepted=${topicItems.length} clusters=${clusters.length}`)
  }

  const payload = {
    preflightRunId: latestPreflight.id,
    windowHours: latestPreflight.window_hours,
    historyHours: latestPreflight.payload.historyHours || 72,
    batchSize: latestPreflight.batch_size,
    rejectedRawIds,
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
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    throw new Error(`Failed to save cluster run: ${insertError.message}`)
  }

  console.log(`\nCluster run salvo em news_cluster_runs: ${insertedRow.id} (${insertedRow.created_at})`)
  console.log(`Resumo: topics=${topicPayloads.length}, accepted=${totalAccepted}, clusters=${totalClusters}, rejected=${rejectedRawIds.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
