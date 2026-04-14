/**
 * News preflight
 *
 * Faz a triagem determinística antes do Gemini:
 * - busca raw_items ainda não processados
 * - remove lixo/boilerplate de forma local
 * - identifica duplicatas óbvias
 * - mostra o lote que seguirá para a síntese
 */

import { createClient } from '@supabase/supabase-js'
import { buildHistoryKey, summarizePreflightByTopicWithHistory } from './news-pipeline-core.mjs'

const PROCESS_LOOKBACK_HOURS = 12
const BATCH_SIZE = 100

function assertEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function printTopicReport(report) {
  console.log(`[${report.topic}] total=${report.total} accepted=${report.acceptedCount} rejected=${report.rejectedCount} duplicates=${report.duplicateCount}`)

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
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data: historyRows, error: historyError } = await db
      .from('raw_items')
      .select('id, url, title, dedup_hash')
      .order('fetched_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (historyError) {
      throw new Error('History DB error: ' + historyError.message)
    }

    if (!historyRows?.length) break

    historyRows.forEach((row) => {
      historyKeys.add(buildHistoryKey(row))
    })

    offset += pageSize
    if (historyRows.length < pageSize) break
  }

  console.log(`Histórico de raw_items indexado: ${historyKeys.size} chaves únicas\n`)

  const allReports = []
  let totalFetched = 0
  let totalAccepted = 0
  let totalRejected = 0
  let totalDuplicates = 0

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
      acceptedIds: [],
      rejected: [],
      duplicateIds: [],
    }

    printTopicReport(topicReport)

    allReports.push({
      topic: topicReport.topic,
      total: topicReport.total,
      acceptedCount: topicReport.acceptedCount,
      rejectedCount: topicReport.rejectedCount,
      duplicateCount: topicReport.duplicateCount,
      acceptedIds: topicReport.acceptedIds,
    })

    totalFetched += topicReport.total
    totalAccepted += topicReport.acceptedCount
    totalRejected += topicReport.rejectedCount
    totalDuplicates += topicReport.duplicateCount
  }

  console.log('\nResumo geral')
  console.log(`  raw_items vistos: ${totalFetched}`)
  console.log(`  prontos para Gemini: ${totalAccepted}`)
  console.log(`  rejeitados localmente: ${totalRejected}`)
  console.log(`  duplicados óbvios: ${totalDuplicates}`)

  console.log('\nJSON do preflight:')
  console.log(JSON.stringify({
    windowHours: PROCESS_LOOKBACK_HOURS,
    batchSize: BATCH_SIZE,
    totalFetched,
    totalAccepted,
    totalRejected,
    totalDuplicates,
    topics: allReports,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
