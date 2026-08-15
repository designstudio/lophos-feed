import { createClient } from '@supabase/supabase-js'
import { clusterDeterministicItems, preflightRawItems } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'
import { DEFAULT_V2_OPTIONS, clusterItemsV2WithRoles, composeEventText, embedEventTexts, loadLocalEmbeddingExtractor } from './news-cluster-v2-core.mjs'

loadScriptEnvironment()

function argNumber(name, fallback) {
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))
  const value = inline ? Number(inline.split('=')[1]) : fallback
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be a positive number`)
  return value
}

function argString(name, fallback) {
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`))
  return inline ? inline.slice(inline.indexOf('=') + 1) : fallback
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`)
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

function stats(clusters) {
  const sizes = clusters.map((cluster) => Array.isArray(cluster) ? cluster.length : cluster.ids.length)
  const distribution = {}
  sizes.forEach((size) => { distribution[size] = (distribution[size] || 0) + 1 })
  return {
    count: sizes.length,
    average: sizes.length ? sizes.reduce((sum, size) => sum + size, 0) / sizes.length : 0,
    singletons: sizes.filter((size) => size === 1).length,
    pairs: sizes.filter((size) => size === 2).length,
    threePlus: sizes.filter((size) => size >= 3).length,
    distribution,
  }
}

function clusterIndex(clusters) {
  const index = new Map()
  clusters.forEach((cluster, clusterNumber) => {
    const ids = Array.isArray(cluster) ? cluster : cluster.ids
    ids.forEach((id) => index.set(id, clusterNumber))
  })
  return index
}

function formatItem(item) {
  return `[${item.topic || 'sem-topico'}] ${item.source_name || 'fonte'} — ${item.title} | lang=${item.language || item.lang || 'n/a'} | ${item.pub_date || 'n/a'}`
}

function searchable(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function printStats(label, value) {
  console.log(`${label}: clusters=${value.count} avg_sources=${value.average.toFixed(2)} singletons=${value.singletons} pairs=${value.pairs} 3+=${value.threePlus}`)
  console.log(`  distribution=${Object.entries(value.distribution).map(([size, count]) => `${size}:${count}`).join(', ')}`)
}

async function main() {
  const hours = argNumber('hours', 12)
  const limit = argNumber('limit', 2000)
  const threshold = argNumber('threshold', Number(process.env.EMBEDDING_MERGE_THRESHOLD || DEFAULT_V2_OPTIONS.semanticThreshold))
  const maxPairHours = argNumber('max-pair-hours', Math.min(18, hours))
  const topK = argNumber('top-k', DEFAULT_V2_OPTIONS.topK)
  const nearMissLimit = argNumber('near-miss-limit', 25)
  const singletonLimit = argNumber('singleton-limit', 2000)
  const focusTerms = argString('focus', '').split(',').map((term) => searchable(term.trim())).filter(Boolean)
  const modelId = process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase environment is not configured')
  const until = new Date(argString('end', new Date().toISOString()))
  if (!Number.isFinite(until.getTime())) throw new Error('--end must be a valid ISO date')
  const untilIso = until.toISOString()
  const since = new Date(until.getTime() - hours * 3_600_000).toISOString()
  const queried = await loadRecentItems(db, since, untilIso, limit)
  const { accepted, rejected, duplicateIds } = preflightRawItems(queried)
  const items = accepted
  console.log(`\nREAD-ONLY clustering V2 dry-run | window=${hours}h since=${since} until=${untilIso}`)
  console.log(`raw=${queried.length} accepted=${items.length} policy_rejected=${rejected.length} exact_in_batch=${duplicateIds.length}`)
  console.log('Dataset is queried directly from raw_items, independent of news_preflight_runs; no writes are issued.')

  const v1 = v1AcrossTopics(items)
  const heapBefore = process.memoryUsage().rss
  const totalStarted = performance.now()
  const loadStarted = performance.now()
  const extractor = await loadLocalEmbeddingExtractor(modelId)
  const modelLoadMs = performance.now() - loadStarted
  const embeddingStarted = performance.now()
  const vectors = await embedEventTexts(extractor, items.map(composeEventText))
  const titleVectors = await embedEventTexts(extractor, items.map((item) => item.title || ''))
  const embeddingMs = performance.now() - embeddingStarted
  const clusteringStarted = performance.now()
  const v2 = clusterItemsV2WithRoles(items, vectors, { semanticThreshold: threshold, maxPairHours, topK, titleVectors })
  const clusteringMs = performance.now() - clusteringStarted
  const totalMs = performance.now() - totalStarted
  const heapAfter = process.memoryUsage().rss

  console.log('\nSUMMARY')
  printStats('V1', stats(v1))
  printStats('V2 binary (audit baseline)', stats(v2.clusters))
  printStats('V2 primary-only', stats(v2.primaryClusters))
  console.log(`roles: primary=${v2.sourceProfiles.filter((profile) => profile.role === 'PRIMARY_EVENT_SOURCE').length} supporting_candidates=${v2.supportingSources.length} primary_events=${v2.eventClusters.length} supporting_attachments=${v2.eventClusters.reduce((sum, cluster) => sum + cluster.supporting.length, 0)} standalone=${v2.standaloneSources.length}`)
  console.log(`model=${modelId} threshold=${threshold} high_confidence=${v2.options.highConfidenceThreshold} supporting_threshold=${v2.options.supportingSemanticThreshold} max_pair_hours=${maxPairHours} top_k=${topK}`)
  console.log(`timing: total_v2=${(totalMs / 1000).toFixed(2)}s model_load=${(modelLoadMs / 1000).toFixed(2)}s embeddings=${(embeddingMs / 1000).toFixed(2)}s clustering=${(clusteringMs / 1000).toFixed(2)}s`)
  console.log(`embedding throughput=${items.length ? ((items.length * 2) / (embeddingMs / 1000)).toFixed(2) : '0'} vectors/s (${items.length} items x event+title) | pair_checks=${v2.pairChecks} candidate_pairs=${v2.candidatePairs}`)
  console.log(`rss_memory_before=${(heapBefore / 1048576).toFixed(1)}MB after=${(heapAfter / 1048576).toFixed(1)}MB delta=${((heapAfter - heapBefore) / 1048576).toFixed(1)}MB`)

  if (hasFlag('performance-only')) return

  console.log('\nV2 PRIMARY EVENT CLUSTERS')
  v2.eventClusters.forEach((cluster, index) => {
    const best = [...cluster.merges].sort((a, b) => b.semanticScore - a.semanticScore)[0]
    console.log(`\nEVENT ${index + 1} — primary=${cluster.ids.length} supporting=${cluster.supporting.length}`)
    console.log(`score=${best?.semanticScore.toFixed(4)} criterion=${best?.reason} lexical=${best?.lexicalScore.toFixed(3)} rare=[${best?.rareTokens.join(', ') || ''}] numbers=[${best?.sharedNumbers.join(', ') || ''}]`)
    console.log('PRIMARY')
    cluster.items.forEach((item) => console.log(`* ${formatItem(item)}`))
    console.log('SUPPORTING')
    if (!cluster.supporting.length) console.log('* none')
    cluster.supporting.forEach(({ item, profile, relation }) => {
      console.log(`* ${formatItem(item)} [${profile.kind}; ${relation.reason}; score=${relation.semanticScore.toFixed(4)}; lexical=${relation.lexicalScore.toFixed(3)}; anchors=${relation.sharedAnchors.join(',')}]`)
    })
  })

  console.log(`\nSTANDALONE SOURCES — showing=${Math.min(v2.standaloneSources.length, singletonLimit)} total=${v2.standaloneSources.length}`)
  v2.standaloneSources.slice(0, singletonLimit).forEach(({ item, role, profile, reason }) => {
    console.log(`* role=${role} kind=${profile.kind} reason=${reason} | ${formatItem(item)}`)
  })

  if (focusTerms.length) {
    console.log(`\nFOCUS AUDIT — terms=[${focusTerms.join(', ')}]`)
    items.forEach((item, itemIndex) => {
      if (!focusTerms.some((term) => searchable(`${item.title} ${item.summary}`).includes(term))) return
      const profile = v2.sourceProfiles[itemIndex]
      const primaryClusterIndex = v2.primaryClusters.findIndex((cluster) => cluster.ids.includes(item.id))
      const attachedEventIndices = v2.eventClusters
        .map((cluster, index) => cluster.supporting.some((entry) => entry.item.id === item.id) ? index + 1 : null)
        .filter(Boolean)
      const relevantRelations = v2.supportRelations
        .filter((relation) => relation.supportingId === item.id)
        .sort((left, right) => Number(right.attach) - Number(left.attach) || right.semanticScore - left.semanticScore)
      const bestRelation = relevantRelations[0]
      const primaryCluster = primaryClusterIndex >= 0 ? v2.primaryClusters[primaryClusterIndex] : null
      const finalRole = profile.role
      console.log(`\nrole=${finalRole} detected=${profile.kind} reasons=[${profile.reasons.join(', ')}] primary_cluster_size=${primaryCluster?.ids.length || 0} attached_events=[${attachedEventIndices.join(', ')}]`)
      if (bestRelation) console.log(`best_support_relation=${bestRelation.attach ? 'SUPPORTING_SOURCE' : 'UNRELATED'} reason=${bestRelation.reason} attach=${bestRelation.attach} score=${bestRelation.semanticScore.toFixed(4)} lexical=${bestRelation.lexicalScore.toFixed(3)} anchors=[${bestRelation.sharedAnchors.join(', ')}] blockers=[${bestRelation.blockers.join(', ')}]`)
      console.log(formatItem(item))
    })
  }

  const v1Index = clusterIndex(v1)
  const v2Index = clusterIndex(v2.primaryClusters)
  console.log('\nDIFF — V2 primary juntou, V1 separou')
  v2.primaryClusters.filter((cluster) => cluster.ids.length > 1 && new Set(cluster.ids.map((id) => v1Index.get(id))).size > 1)
    .forEach((cluster) => console.log(`- ${cluster.items.map((item) => `[${item.topic}] ${item.source_name}: ${item.title}`).join(' || ')}`))
  console.log('\nDIFF — V1 juntou, V2 primary separou')
  v1.filter((cluster) => cluster.length > 1 && new Set(cluster.map((id) => v2Index.get(id))).size > 1)
    .forEach((cluster) => console.log(`- ${cluster.map((id) => items.find((item) => item.id === id)?.title || id).join(' || ')}`))

  const itemCluster = new Map()
  v2.primaryClusters.forEach((cluster, index) => cluster.ids.forEach((id) => itemCluster.set(id, index)))
  const nearMisses = [...v2.pairDecisions.entries()]
    .map(([pairKey, decision]) => {
      const [leftIndex, rightIndex] = pairKey.split(':').map(Number)
      return { pairKey, leftIndex, rightIndex, left: items[leftIndex], right: items[rightIndex], decision }
    })
    .filter((entry) => entry.decision.semanticScore >= 0.80)
    .filter((entry) => (itemCluster.get(entry.left.id) ?? `item:${entry.left.id}`) !== (itemCluster.get(entry.right.id) ?? `item:${entry.right.id}`))
    .filter((entry) => entry.decision.hoursApart === null || entry.decision.hoursApart <= maxPairHours)
    .filter((entry) => !entry.decision.sameSource)
    .filter((entry) =>
      entry.decision.rareTokens.length >= 2 ||
      entry.decision.lexicalScore >= 0.08 ||
      entry.decision.sharedEventKinds.length > 0,
    )
    .sort((a, b) => b.decision.semanticScore - a.decision.semanticScore)

  const bands = [
    { label: '>=0.86 rejected by another gate', min: 0.86, max: Infinity },
    { label: '0.84-0.86', min: 0.84, max: 0.86 },
    { label: '0.82-0.84', min: 0.82, max: 0.84 },
    { label: '0.80-0.82', min: 0.80, max: 0.82 },
  ]
  console.log('\nNEAR MISSES')
  for (const band of bands) {
    const matches = nearMisses.filter((entry) => entry.decision.semanticScore >= band.min && entry.decision.semanticScore < band.max)
    console.log(`\n### ${band.label} | total=${matches.length} showing=${Math.min(matches.length, nearMissLimit)}`)
    for (const entry of matches.slice(0, nearMissLimit)) {
      const { decision, left, right } = entry
      const clusterRejection = decision.merge
        ? (v2.candidatePairKeys.has(entry.pairKey) ? 'complete-link-rejection' : 'top-k-rejection')
        : decision.reason
      const effectiveBlocks = [...decision.blockers, ...(decision.merge ? [clusterRejection] : [])]
      console.log(`\nPAIR ${entry.pairKey} score=${decision.semanticScore.toFixed(4)} title_score=${decision.titleSemanticScore?.toFixed(4) ?? 'n/a'} lexical=${decision.lexicalScore.toFixed(3)} rare=[${decision.rareTokens.join(', ')}] title_tokens=[${decision.sharedTitleTokens.join(', ')}]`)
      console.log(`events: left=[${decision.leftEventKinds.join(', ')}] right=[${decision.rightEventKinds.join(', ')}] shared=[${decision.sharedEventKinds.join(', ')}]`)
      console.log(`blocks=[${effectiveBlocks.join(', ')}] reason=${clusterRejection} hours=${decision.hoursApart?.toFixed(2) ?? 'n/a'}`)
      console.log(`A: [${left.topic || 'sem-topico'}] ${left.source_name || 'fonte'} — ${left.title} | ${left.pub_date || 'n/a'}`)
      console.log(`B: [${right.topic || 'sem-topico'}] ${right.source_name || 'fonte'} — ${right.title} | ${right.pub_date || 'n/a'}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
