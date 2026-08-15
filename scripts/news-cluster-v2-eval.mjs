import fs from 'fs'
import { clusterDeterministicItems, normalizeText } from './news-pipeline-core.mjs'
import {
  DEFAULT_V2_OPTIONS,
  clusterItemsV2,
  composeEventText,
  cosineSimilarity,
  embedEventTexts,
  loadLocalEmbeddingExtractor,
} from './news-cluster-v2-core.mjs'

function metrics(rows) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  for (const row of rows) {
    if (row.expected && row.predicted) tp += 1
    else if (!row.expected && row.predicted) fp += 1
    else if (row.expected) fn += 1
    else tn += 1
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  return { tp, fp, fn, tn, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 }
}

function printMetrics(label, value) {
  console.log(`${label}: precision=${value.precision.toFixed(4)} recall=${value.recall.toFixed(4)} f1=${value.f1.toFixed(4)} TP=${value.tp} FP=${value.fp} FN=${value.fn} TN=${value.tn}`)
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync('fixtures/news-cluster-v2-real-eval.json', 'utf8'))
  const itemByKey = new Map(fixture.items.map((item) => [item.key, { id: item.key, ...item }]))
  const items = fixture.items.map((item) => ({ id: item.key, ...item }))
  const modelId = process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId
  const loadStarted = performance.now()
  const extractor = await loadLocalEmbeddingExtractor(modelId)
  const modelLoadMs = performance.now() - loadStarted
  const embeddingStarted = performance.now()
  const eventVectors = await embedEventTexts(extractor, items.map(composeEventText))
  const titleVectors = await embedEventTexts(extractor, items.map((item) => item.title || ''))
  const embeddingMs = performance.now() - embeddingStarted
  const vectorByKey = new Map(items.map((item, index) => [item.id, eventVectors[index]]))
  const titleVectorByKey = new Map(items.map((item, index) => [item.id, titleVectors[index]]))
  const v2 = clusterItemsV2(items, eventVectors, { titleVectors })
  const v2Baseline = clusterItemsV2(items, eventVectors, { titleVectors, enableRecallSignals: false })
  const v2ClusterById = new Map()
  v2.clusters.forEach((cluster, index) => cluster.ids.forEach((id) => v2ClusterById.set(id, index)))
  const baselineClusterById = new Map()
  v2Baseline.clusters.forEach((cluster, index) => cluster.ids.forEach((id) => baselineClusterById.set(id, index)))

  const rows = fixture.pairs.map((pair) => {
    const left = itemByKey.get(pair.left)
    const right = itemByKey.get(pair.right)
    const expected = pair.label === 'SAME_EVENT'
    const sameTopic = normalizeText(left.topic) === normalizeText(right.topic)
    const v1Predicted = sameTopic && clusterDeterministicItems([
      { ...left, content: left.summary },
      { ...right, content: right.summary },
    ]).length === 1
    const predicted = v2ClusterById.get(left.id) === v2ClusterById.get(right.id)
    const leftIndex = items.findIndex((item) => item.id === left.id)
    const rightIndex = items.findIndex((item) => item.id === right.id)
    const pairKey = leftIndex < rightIndex ? `${leftIndex}:${rightIndex}` : `${rightIndex}:${leftIndex}`
    const decision = v2.pairDecisions.get(pairKey)
    return {
      pair,
      left,
      right,
      expected,
      predicted,
      v1Predicted,
      baselinePredicted: baselineClusterById.get(left.id) === baselineClusterById.get(right.id),
      decision,
      titleScore: cosineSimilarity(titleVectorByKey.get(left.id), titleVectorByKey.get(right.id)),
      eventScore: cosineSimilarity(vectorByKey.get(left.id), vectorByKey.get(right.id)),
    }
  })

  console.log(`Real fixture: items=${items.length} pairs=${rows.length} same=${rows.filter((row) => row.expected).length} different=${rows.filter((row) => !row.expected).length}`)
  printMetrics('V1', metrics(rows.map((row) => ({ expected: row.expected, predicted: row.v1Predicted }))))
  printMetrics('V2 baseline (recall signals off)', metrics(rows.map((row) => ({ expected: row.expected, predicted: row.baselinePredicted }))))
  printMetrics('V2', metrics(rows))
  printMetrics('V2 pair decision (without complete-link)', metrics(rows.map((row) => ({ expected: row.expected, predicted: row.decision.merge }))))
  for (const row of rows.filter((row) => !row.expected && row.decision.merge)) {
    console.log(`EDGE_ONLY_FALSE_POSITIVE ${row.pair.id}: ${row.left.title} || ${row.right.title}`)
  }
  console.log(`model=${modelId} load=${(modelLoadMs / 1000).toFixed(2)}s embeddings=${(embeddingMs / 1000).toFixed(2)}s`)

  const errors = rows.filter((row) => row.expected !== row.predicted)
  console.log(`\nV2 ERRORS (${errors.length})`)
  for (const row of errors) {
    console.log(`\n${row.expected ? 'FALSE_NEGATIVE' : 'FALSE_POSITIVE'} ${row.pair.id} event=${row.eventScore.toFixed(4)} title=${row.titleScore.toFixed(4)} lexical=${row.decision.lexicalScore.toFixed(3)} rare=[${row.decision.rareTokens.join(', ')}] events=${row.decision.leftEventKinds.join('+')}|${row.decision.rightEventKinds.join('+')} blocks=[${row.decision.blockers.join(', ')}] reason=${row.decision.reason}`)
    console.log(`A: ${row.left.source_name} — ${row.left.title}`)
    console.log(`B: ${row.right.source_name} — ${row.right.title}`)
  }

  const titleBands = [0.95, 0.93, 0.91, 0.89, 0.87]
  console.log('\nTITLE-ONLY ISOLATED SIGNAL')
  for (const threshold of titleBands) {
    const candidateRows = rows.map((row) => ({ expected: row.expected, predicted: row.titleScore >= threshold }))
    printMetrics(`title>=${threshold}`, metrics(candidateRows))
  }

  const titleComplement = rows.map((row) => {
    const hardBlocked = row.decision.sameSource || row.decision.blockers.some((blocker) => blocker.startsWith('event-conflict') || blocker.startsWith('year-conflict') || blocker === 'time-window')
    const extra = !hardBlocked && row.eventScore >= 0.90 && row.titleScore >= 0.93 && row.decision.sharedTitleTokens.length >= 3
    return { expected: row.expected, predicted: row.predicted || extra }
  })
  printMetrics('V2 + isolated title complement', metrics(titleComplement))

  const refinedHardGates = rows.map((row) => {
    const titleYearConflict = row.decision.leftTitleYears.length > 0 && row.decision.rightTitleYears.length > 0 && !row.decision.leftTitleYears.some((year) => row.decision.rightTitleYears.includes(year))
    const titleEventConflict = row.decision.leftTitleEventKinds.length > 0 && row.decision.rightTitleEventKinds.length > 0 && !row.decision.leftTitleEventKinds.some((kind) => row.decision.rightTitleEventKinds.includes(kind))
    const wasOnlyRefinableHardGate = !row.decision.sameSource && row.decision.blockers.every((blocker) =>
      blocker.startsWith('event-conflict') || blocker.startsWith('year-conflict') || !['time-window'].includes(blocker),
    )
    const extra = wasOnlyRefinableHardGate && !titleYearConflict && !titleEventConflict && row.eventScore >= 0.88 && row.decision.rareTokens.length >= 3 && row.decision.lexicalScore >= 0.12
    return { expected: row.expected, predicted: row.predicted || extra }
  })
  printMetrics('V2 + isolated title-scoped hard gates', metrics(refinedHardGates))

  const yearOnly = rows.map((row) => {
    const titleYearConflict = row.decision.leftTitleYears.length > 0 && row.decision.rightTitleYears.length > 0 && !row.decision.leftTitleYears.some((year) => row.decision.rightTitleYears.includes(year))
    const extra = row.decision.blockers.some((blocker) => blocker.startsWith('year-conflict')) && !titleYearConflict && !row.decision.sameSource && row.eventScore >= 0.90 && row.decision.rareTokens.length >= 4 && row.decision.lexicalScore >= 0.12
    return { expected: row.expected, predicted: row.predicted || extra }
  })
  printMetrics('V2 + isolated title-year conflict', metrics(yearOnly))

  const eventOnly = rows.map((row) => {
    const titleEventConflict = row.decision.leftTitleEventKinds.length > 0 && row.decision.rightTitleEventKinds.length > 0 && !row.decision.leftTitleEventKinds.some((kind) => row.decision.rightTitleEventKinds.includes(kind))
    const extra = row.decision.blockers.some((blocker) => blocker.startsWith('event-conflict')) && !titleEventConflict && !row.decision.sameSource && row.eventScore >= 0.88 && row.decision.rareTokens.length >= 4 && row.decision.lexicalScore >= 0.12
    return { expected: row.expected, predicted: row.predicted || extra }
  })
  printMetrics('V2 + isolated title-event conflict', metrics(eventOnly))

  const combinedConservative = rows.map((row, index) => ({
    expected: row.expected,
    predicted: titleComplement[index].predicted || yearOnly[index].predicted || eventOnly[index].predicted,
  }))
  printMetrics('V2 + combined conservative candidates', metrics(combinedConservative))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
