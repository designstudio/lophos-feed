import { normalizeText, strongIntersection, textOverlapScore } from './news-pipeline-core.mjs'

export const DEFAULT_V2_OPTIONS = Object.freeze({
  modelId: 'Xenova/multilingual-e5-small',
  semanticThreshold: 0.86,
  highConfidenceThreshold: 0.93,
  maxPairHours: 18,
  topK: 20,
  enableRecallSignals: true,
})

const EVENT_SIGNALS = Object.freeze({
  trailer: /\b(trailer|teaser|preview|video|clipe|clip)\b/i,
  boxoffice: /\b(box office|bilheteria|arrecad|revenue|grossed|ticket sales)\b/i,
  casting: /\b(cast|casting|elenco|estrela|starring|contrat\w*|joins?|papel|role)\b/i,
  directing: /\b(director|directs?|directing|dirigir|diretor|diretora|comanda|helm)\b/i,
  renewal: /\b(renewed|renewal|renova\w*|nova temporada|next season|temporada confirmada)\b/i,
  cancellation: /\b(cancelled|canceled|cancelad\w*|encerrad\w*)\b/i,
  release: /\b(release date|data de estreia|launch date|chega em|estreia em|lan[cç]amento)\b/i,
  interview: /\b(interview|entrevista|conversa com|talks? about)\b/i,
  acquisition: /\b(acquires?|acquisition|compra|comprou|adquire|aquisi[cç][aã]o)\b/i,
  lawsuit: /\b(lawsuit|processo judicial|sues?|processa|tribunal|court)\b/i,
})

const RARE_TOKEN_NOISE = new Set([
  'which', 'whose', 'about', 'after', 'before', 'where', 'their', 'there', 'these', 'those',
  'nesta', 'neste', 'nessa', 'nesse', 'sexta', 'feira', 'agosto', 'menos', 'forma', 'novo', 'nova',
  'video', 'videos', 'report', 'reports', 'according', 'during', 'first', 'latest', 'upcoming',
])

function normalizeVector(output) {
  if (Array.isArray(output)) return Array.isArray(output[0]) ? output[0] : output
  if (typeof output?.tolist === 'function') {
    const list = output.tolist()
    return Array.isArray(list?.[0]) ? list[0] : list
  }
  if (output?.data) return Array.from(output.data)
  throw new Error('Unsupported embedding output shape')
}

export function composeEventText(item) {
  return [item?.title, item?.summary]
    .filter(Boolean)
    .join(' ')
    .replace(/&#(?:x[0-9a-f]+|\d+);/gi, ' ')
    .replace(/&(?:amp|quot|apos|nbsp|lt|gt);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cosineSimilarity(a, b) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    normA += a[index] * a[index]
    normB += b[index] * b[index]
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0
}

export async function loadLocalEmbeddingExtractor(modelId = DEFAULT_V2_OPTIONS.modelId) {
  const { pipeline } = await import('@xenova/transformers')
  return pipeline('feature-extraction', modelId, { quantized: true })
}

export async function embedEventTexts(extractor, texts) {
  const vectors = []
  for (const text of texts) {
    const output = await extractor(`query: ${text}`, { pooling: 'mean', normalize: true })
    vectors.push(normalizeVector(output))
  }
  return vectors
}

function itemTime(item) {
  for (const value of [item?.pub_date, item?.fetched_at]) {
    const parsed = Date.parse(value || '')
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function sourceKey(item) {
  for (const value of [item?.url, item?.source_url]) {
    try {
      const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
      const parts = hostname.split('.')
      if (parts.length >= 2) return parts.slice(-2).join('.')
    } catch {}
  }
  const normalized = normalizeText(item?.source_name || item?.source_url || '')
  if (/^g1\b/.test(normalized)) return 'g1'
  if (/^ign\b/.test(normalized)) return 'ign'
  return normalized
}

function eventKinds(text) {
  const kinds = []
  for (const [kind, pattern] of Object.entries(EVENT_SIGNALS)) {
    if (pattern.test(text)) kinds.push(kind)
  }
  return kinds
}

function extractNumbers(text) {
  return [...new Set(String(text || '').match(/\b(?:19|20)\d{2}\b|\b\d+(?:[.,]\d+)?\b/g) || [])]
}

function pairDecision(left, right, leftVector, rightVector, leftTitleVector, rightTitleVector, options, rareTokens = []) {
  const leftText = composeEventText(left)
  const rightText = composeEventText(right)
  const leftTitle = composeEventText({ title: left?.title })
  const rightTitle = composeEventText({ title: right?.title })
  const semanticScore = cosineSimilarity(leftVector, rightVector)
  const titleSemanticScore = leftTitleVector && rightTitleVector ? cosineSimilarity(leftTitleVector, rightTitleVector) : null
  const lexicalScore = textOverlapScore(leftText, rightText)
  const strong = strongIntersection(leftText, rightText)
  const leftKinds = eventKinds(leftText)
  const rightKinds = eventKinds(rightText)
  const leftTitleKinds = eventKinds(leftTitle)
  const rightTitleKinds = eventKinds(rightTitle)
  const sharedKinds = leftKinds.filter((kind) => rightKinds.includes(kind))
  const conflictingEventKinds = leftKinds.length > 0 && rightKinds.length > 0 && sharedKinds.length === 0
  const conflictingTitleEventKinds = leftTitleKinds.length > 0 && rightTitleKinds.length > 0 && !leftTitleKinds.some((kind) => rightTitleKinds.includes(kind))
  const leftNumbers = extractNumbers(leftText)
  const rightNumbers = extractNumbers(rightText)
  const sharedNumbers = leftNumbers.filter((number) => rightNumbers.includes(number))
  const leftYears = leftNumbers.filter((number) => /^(?:19|20)\d{2}$/.test(number))
  const rightYears = rightNumbers.filter((number) => /^(?:19|20)\d{2}$/.test(number))
  const leftTitleYears = extractNumbers(leftTitle).filter((number) => /^(?:19|20)\d{2}$/.test(number))
  const rightTitleYears = extractNumbers(rightTitle).filter((number) => /^(?:19|20)\d{2}$/.test(number))
  const leftTitleTokens = new Set(normalizeText(leftTitle).split(' ').filter((token) => token.length >= 5 && !RARE_TOKEN_NOISE.has(token)))
  const rightTitleTokens = new Set(normalizeText(rightTitle).split(' ').filter((token) => token.length >= 5 && !RARE_TOKEN_NOISE.has(token)))
  const sharedTitleTokens = [...leftTitleTokens].filter((token) => rightTitleTokens.has(token))
  const conflictingYears = leftYears.length > 0 && rightYears.length > 0 && !leftYears.some((year) => rightYears.includes(year))
  const conflictingTitleYears = leftTitleYears.length > 0 && rightTitleYears.length > 0 && !leftTitleYears.some((year) => rightTitleYears.includes(year))
  const leftTime = itemTime(left)
  const rightTime = itemTime(right)
  const hoursApart = leftTime === null || rightTime === null ? null : Math.abs(leftTime - rightTime) / 3_600_000
  const outsideTimeWindow = hoursApart !== null && hoursApart > options.maxPairHours
  const sameSource = sourceKey(left) && sourceKey(left) === sourceKey(right)
  const lexicalConfirmation = lexicalScore >= 0.22 && strong.length >= 2
  const rareConfirmation = rareTokens.length >= 2
  const factualConfirmation = rareTokens.length >= 3 && (
    (sharedKinds.length > 0 && lexicalScore >= 0.08) || lexicalScore >= 0.18
  )
  const highConfidence = semanticScore >= options.highConfidenceThreshold && lexicalScore >= 0.12 && rareConfirmation
  const supportedSemantic = semanticScore >= options.semanticThreshold && factualConfirmation
  const titleComplement = options.enableRecallSignals && titleSemanticScore !== null && titleSemanticScore >= 0.93 && semanticScore >= 0.90 && sharedTitleTokens.length >= 3
  const yearConflictRescue = options.enableRecallSignals && conflictingYears && !conflictingTitleYears && semanticScore >= 0.90 && rareTokens.length >= 4 && lexicalScore >= 0.12
  const eventConflictRescue = options.enableRecallSignals && conflictingEventKinds && !conflictingTitleEventKinds && semanticScore >= 0.88 && rareTokens.length >= 4 && lexicalScore >= 0.12
  const blockingYearConflict = conflictingYears && !yearConflictRescue
  const blockingEventConflict = conflictingEventKinds && !eventConflictRescue
  const merge = !outsideTimeWindow && !blockingEventConflict && !blockingYearConflict && !sameSource && (highConfidence || supportedSemantic || titleComplement || yearConflictRescue || eventConflictRescue)
  const blockers = []
  if (outsideTimeWindow) blockers.push('time-window')
  if (blockingEventConflict) blockers.push(`event-conflict:${leftKinds.join('+')}!=${rightKinds.join('+')}`)
  if (blockingYearConflict) blockers.push(`year-conflict:${leftYears.join('+')}!=${rightYears.join('+')}`)
  if (sameSource) blockers.push('same-source-protection')
  if (!highConfidence && !supportedSemantic && !titleComplement && !yearConflictRescue && !eventConflictRescue) {
    if (semanticScore < options.semanticThreshold) blockers.push('semantic-below-base')
    if (semanticScore < options.highConfidenceThreshold) blockers.push('semantic-below-high-confidence')
    if (lexicalScore < 0.12) blockers.push('lexical-below-high-confidence')
    if (!rareConfirmation) blockers.push('rare-token-confirmation')
    if (!factualConfirmation) blockers.push('factual-confirmation')
  }

  const reason = outsideTimeWindow
    ? 'time-window'
    : blockingEventConflict
      ? `event-conflict:${leftKinds.join('+')}!=${rightKinds.join('+')}`
      : blockingYearConflict
        ? `year-conflict:${leftYears.join('+')}!=${rightYears.join('+')}`
      : sameSource
        ? 'same-source-protection'
      : highConfidence
        ? 'semantic-high-confidence'
        : supportedSemantic
          ? (factualConfirmation ? 'semantic+factual-confirmation' : 'semantic+lexical-confirmation')
          : titleComplement
            ? 'semantic+title-complement'
            : yearConflictRescue
              ? 'semantic+title-year-rescue'
              : eventConflictRescue
                ? 'semantic+title-event-rescue'
          : 'below-hybrid-threshold'

  return {
    merge,
    reason,
    semanticScore,
    titleSemanticScore,
    lexicalScore,
    strong,
    rareTokens,
    sharedNumbers,
    sharedEventKinds: sharedKinds,
    leftEventKinds: leftKinds,
    rightEventKinds: rightKinds,
    leftTitleEventKinds: leftTitleKinds,
    rightTitleEventKinds: rightTitleKinds,
    leftTitleYears,
    rightTitleYears,
    sharedTitleTokens,
    blockers,
    highConfidence,
    supportedSemantic,
    sameSource: Boolean(sameSource),
    conflictingYears,
    conflictingTitleYears,
    conflictingTitleEventKinds,
    titleComplement,
    yearConflictRescue,
    eventConflictRescue,
    hoursApart,
    sameTopic: normalizeText(left?.topic) === normalizeText(right?.topic),
  }
}

export function clusterItemsV2(items, vectors, overrides = {}) {
  if (items.length !== vectors.length) throw new Error('items and vectors must have the same length')
  const options = { ...DEFAULT_V2_OPTIONS, ...overrides }
  const titleVectors = Array.isArray(overrides.titleVectors) ? overrides.titleVectors : null
  if (titleVectors && titleVectors.length !== items.length) throw new Error('titleVectors and items must have the same length')
  const decisions = new Map()
  const candidatesByItem = Array.from({ length: items.length }, () => [])
  const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`
  const documentFrequency = new Map()
  const tokensByItem = items.map((item) => new Set(
    normalizeText(composeEventText(item)).split(' ').filter((token) => token.length >= 5 && !RARE_TOKEN_NOISE.has(token)),
  ))
  for (const tokens of tokensByItem) {
    for (const token of tokens) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1)
  }
  const rareCutoff = Math.max(2, Math.ceil(items.length * 0.03))

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const rareTokens = [...tokensByItem[left]].filter((token) =>
        tokensByItem[right].has(token) && (documentFrequency.get(token) || 0) <= rareCutoff,
      )
      const decision = pairDecision(items[left], items[right], vectors[left], vectors[right], titleVectors?.[left], titleVectors?.[right], options, rareTokens)
      decisions.set(key(left, right), decision)
      if (decision.hoursApart === null || decision.hoursApart <= options.maxPairHours) {
        candidatesByItem[left].push({ index: right, score: decision.semanticScore })
        candidatesByItem[right].push({ index: left, score: decision.semanticScore })
      }
    }
  }

  const allowedPairs = new Set()
  for (let index = 0; index < candidatesByItem.length; index += 1) {
    candidatesByItem[index]
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK)
      .forEach((candidate) => allowedPairs.add(key(index, candidate.index)))
  }

  let clusters = items.map((_, index) => [index])
  const mergeEdges = [...allowedPairs]
    .map((pairKey) => {
      const [left, right] = pairKey.split(':').map(Number)
      return { left, right, decision: decisions.get(pairKey) }
    })
    .filter((edge) => edge.decision.merge)
    .sort((a, b) => b.decision.semanticScore - a.decision.semanticScore)

  const acceptedEdges = []
  for (const edge of mergeEdges) {
    const leftClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.left))
    const rightClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.right))
    if (leftClusterIndex === rightClusterIndex) continue
    const leftCluster = clusters[leftClusterIndex]
    const rightCluster = clusters[rightClusterIndex]
    const completeLinkPass = leftCluster.every((left) => rightCluster.every((right) => decisions.get(key(left, right))?.merge))
    if (!completeLinkPass) continue
    const merged = [...leftCluster, ...rightCluster]
    clusters = clusters.filter((_, index) => index !== leftClusterIndex && index !== rightClusterIndex)
    clusters.push(merged)
    acceptedEdges.push(edge)
  }

  clusters.sort((a, b) => Math.min(...a) - Math.min(...b))
  return {
    clusters: clusters.map((members) => ({
      ids: members.map((index) => items[index].id),
      items: members.map((index) => items[index]),
      merges: acceptedEdges
        .filter((edge) => members.includes(edge.left) && members.includes(edge.right))
        .map((edge) => ({
          leftId: items[edge.left].id,
          rightId: items[edge.right].id,
          ...edge.decision,
        })),
    })),
    pairChecks: decisions.size,
    candidatePairs: allowedPairs.size,
    pairDecisions: decisions,
    candidatePairKeys: allowedPairs,
    options,
  }
}
