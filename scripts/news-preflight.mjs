/**
 * News preflight
 *
 * Faz a triagem determinística antes do Mistral:
 * - busca raw_items ainda não processados
 * - remove lixo/boilerplate de forma local
 * - identifica duplicatas óbvias
 * - mostra o lote que seguirá para a síntese
 */

import { createClient } from '@supabase/supabase-js'
import { buildHistoryKey, findSemanticDuplicateMatches, summarizePreflightByTopicWithHistory } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'

const PROCESS_LOOKBACK_HOURS = 12
const HISTORY_LOOKBACK_HOURS = 72
const BATCH_SIZE = 100

loadScriptEnvironment()

function assertEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function printTopicReport(report) {
  const semanticCount = report.semanticDuplicateCount ?? 0
  const readyCount = report.readyCount ?? report.acceptedCount
  console.log(`[${report.topic}] total=${report.total} accepted=${readyCount} rejected=${report.rejectedCount} exact=${report.duplicateCount} semantic=${semanticCount}`)

  if (report.rejected.length > 0) {
    const rejectedPreview = report.rejected
      .slice(0, 5)
      .map((item) => `${item.reason}:${item.title?.slice(0, 60) || item.id}`)
      .join(' | ')
    console.log(`  rejeitados: ${rejectedPreview}`)
  }

  if (report.duplicateIds.length > 0) {
    console.log(`  duplicados: ${report.duplicateIds.map((id) => id.slice(0, 8)).join(', ')}`)
  }

  if (semanticCount > 0) {
    console.log(`  semantic dupes: ${semanticCount}`)
  }
}

async function main() {
  const db = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const rawLookbackSince = new Date(Date.now() - PROCESS_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

  const { data: topicRows, error: topicError } = await db
    .from('raw_items')
    .select('topic')
    .eq('processed', false)
    .gte('pub_date', rawLookbackSince)

  if (topicError) throw new Error('DB error: ' + topicError.message)
  if (!topicRows?.length) {
    console.log('No unprocessed items found.')
    return
  }

  const topics = [...new Set(topicRows.map((row) => row.topic).filter(Boolean))]
  console.log(`\n🧪 News preflight`)
  console.log(`Janela de processamento: últimas ${PROCESS_LOOKBACK_HOURS}h (${rawLookbackSince})`)
  console.log(`Topics encontrados: ${topics.join(', ')}\n`)

  const historyKeys = new Set()
  const historyByTopic = new Map()
  const historyLookbackSince = new Date(Date.now() - HISTORY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data: historyRows, error: historyError } = await db
      .from('raw_items')
      .select('id, url, title, summary, content, dedup_hash, topic, source_name')
      .gte('pub_date', historyLookbackSince)
      .order('fetched_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (historyError) {
      throw new Error('History DB error: ' + historyError.message)
    }

    if (!historyRows?.length) break

    historyRows.forEach((row) => {
      historyKeys.add(buildHistoryKey(row))
      const bucket = historyByTopic.get(row.topic) || []
      bucket.push(row)
      historyByTopic.set(row.topic, bucket)
    })

    offset += pageSize
    if (historyRows.length < pageSize) break
  }

  console.log(`Histórico de raw_items indexado (últimas ${HISTORY_LOOKBACK_HOURS}h): ${historyKeys.size} chaves únicas\n`)

  const allReports = []
  const allSemanticMatches = []
  let totalFetched = 0
  let totalAccepted = 0
  let totalRejected = 0
  let totalDuplicates = 0
  let totalSemanticDuplicates = 0

  for (const topic of topics) {
    const { data: rawItems, error } = await db
      .from('raw_items')
      .select('id, url, title, content, summary, image_url, video_url, topic, source_name, source_url, pub_date, fetched_at')
      .eq('topic', topic)
      .eq('processed', false)
      .gte('pub_date', rawLookbackSince)
      .order('pub_date', { ascending: false })
      .limit(BATCH_SIZE)

    if (error) {
      console.error(`[${topic}] DB error: ${error.message}`)
      continue
    }

    const currentKeys = new Set((rawItems || []).map((item) => buildHistoryKey(item)))
    const topicHistoryKeys = new Set(historyKeys)
    currentKeys.forEach((key) => topicHistoryKeys.delete(key))

    const report = summarizePreflightByTopicWithHistory(rawItems || [], topicHistoryKeys)
    const topicReport = report[0] || {
      topic,
      total: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      semanticDuplicateCount: 0,
      acceptedIds: [],
      rejected: [],
      duplicateIds: [],
      semanticDuplicateIds: [],
    }

    const semanticMatches = findSemanticDuplicateMatches(
      rawItems || [],
      (historyByTopic.get(topic) || []).filter((historyItem) => !(rawItems || []).some((item) => item.id === historyItem.id)),
      { similarityThreshold: 0.3, minStrongTokens: 3 },
    )
    const semanticDuplicateIds = new Set(semanticMatches.map((match) => match.currentId))
    const acceptedForClusterIds = (topicReport.acceptedIds || []).filter((id) => !semanticDuplicateIds.has(id))

    const semanticPreview = semanticMatches.slice(0, 5).map((match) =>
      `${match.currentTitle?.slice(0, 60) || match.currentId} ↔ ${match.historySource || 'history'}: ${match.historyTitle?.slice(0, 60) || match.historyId} (${match.score.toFixed(3)})`
    )

    if (semanticMatches.length > 0) {
      console.log(`  semantic dupes: ${semanticMatches.length}`)
      semanticPreview.forEach((line) => console.log(`    ${line}`))
    }

    allSemanticMatches.push(...semanticMatches.map((match) => ({
      topic: topicReport.topic,
      ...match,
    })))

    printTopicReport({
      ...topicReport,
      acceptedCount: topicReport.acceptedCount,
      semanticDuplicateCount: semanticMatches.length,
      readyCount: acceptedForClusterIds.length,
    })

    allReports.push({
      topic: topicReport.topic,
      total: topicReport.total,
      acceptedCount: acceptedForClusterIds.length,
      acceptedBeforeSemanticCount: topicReport.acceptedCount,
      rejectedCount: topicReport.rejectedCount,
      duplicateCount: topicReport.duplicateCount,
      semanticDuplicateCount: semanticMatches.length,
      acceptedIds: topicReport.acceptedIds,
      acceptedForClusterIds,
      rejectedIds: topicReport.rejected.map((item) => item.id),
      duplicateIds: topicReport.duplicateIds,
      semanticDuplicateIds: Array.from(semanticDuplicateIds),
    })

    totalFetched += topicReport.total
    totalAccepted += acceptedForClusterIds.length
    totalRejected += topicReport.rejectedCount
    totalDuplicates += topicReport.duplicateCount
    totalSemanticDuplicates += semanticMatches.length
  }

  console.log('\nResumo geral')
  console.log(`  raw_items vistos: ${totalFetched}`)
  console.log(`  prontos para Mistral: ${totalAccepted}`)
  console.log(`  rejeitados localmente: ${totalRejected}`)
  console.log(`  duplicados óbvios: ${totalDuplicates}`)
  console.log(`  duplicados semânticos: ${totalSemanticDuplicates}`)

  console.log('\nJSON do preflight:')
  const payload = {
    windowHours: PROCESS_LOOKBACK_HOURS,
    historyHours: HISTORY_LOOKBACK_HOURS,
    batchSize: BATCH_SIZE,
    totalFetched,
    totalAccepted,
    totalRejected,
    totalDuplicates,
    totalSemanticDuplicates,
    rejectedRawIds: allReports.flatMap((report) => report.rejectedIds || []),
    duplicateRawIds: allReports.flatMap((report) => report.duplicateIds || []),
    semanticDuplicateRawIds: allReports.flatMap((report) => report.semanticDuplicateIds || []),
    topics: allReports,
    semanticMatches: allSemanticMatches,
  }

  console.log(JSON.stringify(payload, null, 2))

  const { data: insertedRow, error: insertError } = await db
    .from('news_preflight_runs')
    .insert({
      window_hours: PROCESS_LOOKBACK_HOURS,
      batch_size: BATCH_SIZE,
      total_fetched: totalFetched,
      total_accepted: totalAccepted,
      total_rejected: totalRejected,
      total_duplicates: totalDuplicates,
      total_semantic_duplicates: totalSemanticDuplicates,
      payload,
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    console.error(`Falha ao salvar execução do preflight: ${insertError.message}`)
  } else if (insertedRow) {
    console.log(`\nPreflight salvo em news_preflight_runs: ${insertedRow.id} (${insertedRow.created_at})`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
