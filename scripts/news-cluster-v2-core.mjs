import { normalizeText, strongIntersection, textOverlapScore } from './news-pipeline-core.mjs'

export const DEFAULT_V2_OPTIONS = Object.freeze({
  modelId: 'Xenova/multilingual-e5-small',
  semanticThreshold: 0.86,
  highConfidenceThreshold: 0.93,
  supportingSemanticThreshold: 0.84,
  minPrimarySourcesForSupporting: 2,
  maxPairHours: 18,
  topK: 20,
  enableRecallSignals: true,
})

export const SOURCE_ROLES = Object.freeze({
  PRIMARY: 'PRIMARY_EVENT_SOURCE',
  SUPPORTING: 'SUPPORTING_SOURCE',
  UNRELATED: 'UNRELATED',
})

const EVENT_SIGNALS = Object.freeze({
  trailer: /\b(trailer|teaser|preview|video|clipe|clip)\b/i,
  boxoffice: /\b(box office|bilheteria|arrecad\w*|revenue|grossed|ticket sales)\b/i,
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

const SUPPORT_ANCHOR_NOISE = new Set([
  ...RARE_TOKEN_NOISE,
  'announced', 'announcement', 'announcements', 'revealed', 'reveals', 'showed', 'shown',
  'trailer', 'teaser', 'footage', 'movie', 'movies', 'series', 'season', 'special', 'event',
  'first', 'look', 'looks', 'review', 'analysis', 'explained', 'everything', 'learned',
  'disney', 'studios', 'anaheim', 'd23', 'comiccon', 'showcase',
])

const ROUNDUP_TITLE_PATTERNS = Object.freeze([
  /\beverything\s+(?:announced|revealed|we\s+(?:learned|know|saw))\b/i,
  /\b(?:all|every)\s+(?:the\s+)?(?:trailers?|announcements?|reveals?|news|updates?)\b/i,
  /\b(?:all|everything)\s+(?:you\s+need\s+to\s+know|we\s+know)\b/i,
  /\b(?:tudo|todos?)\s+(?:o\s+que\s+)?(?:foi\s+)?(?:anunciado|revelado|aprendemos|sabemos)\b/i,
  /\b(?:liveblog|live\s+blog|live\s+updates?|ao\s+vivo)\b/i,
  /\b(?:roundup|recap|resumo\s+geral|highlights?)\b/i,
])

const EVENT_CONTEXT_PATTERN = /\b(?:d23|comic[ -]?con|sdcc|gamescom|cinemacon|ces|wwdc|keynote|showcase|fan\s+event|evento|conferencia|convention|expo)\b/i
const BROAD_SCOPE_PATTERN = /\b(?:and\s+more|e\s+mais|plus\s+more|everything|all\s+(?:the\s+)?(?:news|announcements?|trailers?))\b/i
const ANALYSIS_TITLE_PATTERNS = Object.freeze([
  /\bwhy\s+(?:we(?:\s+re|\s+are)|i(?:\s+m|\s+am)|you(?:\s+re|\s+are)|this|the)\b/i,
  /\b(?:we(?:\s+re|\s+are)|i(?:\s+m|\s+am))\s+(?:pumped|excited|worried|optimistic|concerned)\b/i,
  /\b(?:analysis|opinion|editorial|reaction|breakdown|deep\s+dive|explained|explainer)\b/i,
  /\bwhat\s+.+\s+means\s+for\b/i,
  /\b(?:por\s+que|porque)\s+(?:estamos|voce|isso|este|esta)\b/i,
])
const REVIEW_TITLE_PATTERNS = Object.freeze([
  /(?:^|[\s:|\-])review(?:$|[\s:|\-])/i,
  /(?:^|[\s:|\-])critica(?:$|[\s:|\-])/i,
  /\b(?:verdict|veredito|hands[ -]?on|first\s+impressions?|impressoes)\b/i,
])

function regexReason(text, patterns, prefix) {
  const index = patterns.findIndex((pattern) => pattern.test(text))
  return index >= 0 ? `${prefix}:${index + 1}` : null
}

function normalizedAnchorTokens(value) {
  const joinedHyphens = String(value || '').replace(/([a-z0-9])[-\u2013\u2014]([a-z0-9])/gi, '$1$2')
  return new Set(normalizeText(joinedHyphens)
    .split(' ')
    .filter((token) => token.length >= 4 && !SUPPORT_ANCHOR_NOISE.has(token)))
}

function sharedSupportAnchors(supportingItem, primaryItem) {
  const supportingTokens = normalizedAnchorTokens(composeEventText(supportingItem))
  const primaryTokens = normalizedAnchorTokens(primaryItem?.title || '')
  return [...primaryTokens].filter((token) => supportingTokens.has(token))
}

export function classifyEditorialSource(item) {
  const rawTitle = String(item?.title || '')
  const title = normalizeText(rawTitle)
  const summary = normalizeText(item?.summary || '')
  const roundupReason = regexReason(title, ROUNDUP_TITLE_PATTERNS, 'roundup-title')
  const eventContext = EVENT_CONTEXT_PATTERN.test(title)
  const broadScope = BROAD_SCOPE_PATTERN.test(title)
  const compoundEventTitle = eventContext && /:/.test(rawTitle) && /\band\b/i.test(rawTitle) && (
    /\bseason\s+\d+\s+and\s+[A-Z0-9]/.test(rawTitle) ||
    (summary.match(/\b(?:plus|also|along with|as well as|meanwhile)\b/g) || []).length >= 1
  )

  if (roundupReason || (eventContext && broadScope) || compoundEventTitle) {
    return {
      role: SOURCE_ROLES.SUPPORTING,
      kind: compoundEventTitle ? 'multi-event' : /live/.test(roundupReason || '') ? 'liveblog' : 'roundup',
      reasons: [roundupReason, eventContext ? 'event-context' : null, broadScope ? 'broad-scope' : null, compoundEventTitle ? 'compound-event-title' : null].filter(Boolean),
    }
  }

  const reviewReason = regexReason(title, REVIEW_TITLE_PATTERNS, 'review-title')
  if (reviewReason) {
    return { role: SOURCE_ROLES.SUPPORTING, kind: 'review', reasons: [reviewReason] }
  }

  const analysisReason = regexReason(title, ANALYSIS_TITLE_PATTERNS, 'analysis-title')
  if (analysisReason) {
    return { role: SOURCE_ROLES.SUPPORTING, kind: 'analysis', reasons: [analysisReason] }
  }

  const titleKinds = eventKinds(title)
  return {
    role: SOURCE_ROLES.PRIMARY,
    kind: 'hard-news',
    reasons: [titleKinds.length ? `central-event:${titleKinds.join('+')}` : 'central-event:default'],
  }
}

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
  const summaryOnlyEventConflictRescue = options.enableRecallSignals && conflictingEventKinds && !conflictingTitleEventKinds &&
    (leftTitleKinds.length === 0 || rightTitleKinds.length === 0) && semanticScore >= 0.90 && rareTokens.length >= 2 && lexicalScore >= 0.12
  const eventConflictRescue = options.enableRecallSignals && conflictingEventKinds && !conflictingTitleEventKinds && (
    (semanticScore >= 0.88 && rareTokens.length >= 4 && lexicalScore >= 0.12) || summaryOnlyEventConflictRescue
  )
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

  let reason = 'below-hybrid-threshold'
  if (outsideTimeWindow) reason = 'time-window'
  else if (blockingEventConflict) reason = `event-conflict:${leftKinds.join('+')}!=${rightKinds.join('+')}`
  else if (blockingYearConflict) reason = `year-conflict:${leftYears.join('+')}!=${rightYears.join('+')}`
  else if (sameSource) reason = 'same-source-protection'
  else if (summaryOnlyEventConflictRescue) reason = 'semantic+summary-event-centrality-rescue'
  else if (eventConflictRescue) reason = 'semantic+title-event-rescue'
  else if (highConfidence) reason = 'semantic-high-confidence'
  else if (supportedSemantic) reason = factualConfirmation ? 'semantic+factual-confirmation' : 'semantic+lexical-confirmation'
  else if (titleComplement) reason = 'semantic+title-complement'
  else if (yearConflictRescue) reason = 'semantic+title-year-rescue'

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
    summaryOnlyEventConflictRescue,
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

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`
}

function selectCandidatePairsForIndices(indices, decisions, options) {
  const candidatesByIndex = new Map(indices.map((index) => [index, []]))
  for (let leftPosition = 0; leftPosition < indices.length; leftPosition += 1) {
    for (let rightPosition = leftPosition + 1; rightPosition < indices.length; rightPosition += 1) {
      const left = indices[leftPosition]
      const right = indices[rightPosition]
      const decision = decisions.get(pairKey(left, right))
      if (!decision || (decision.hoursApart !== null && decision.hoursApart > options.maxPairHours)) continue
      candidatesByIndex.get(left).push({ index: right, score: decision.semanticScore })
      candidatesByIndex.get(right).push({ index: left, score: decision.semanticScore })
    }
  }

  const allowedPairs = new Set()
  for (const [index, candidates] of candidatesByIndex) {
    candidates
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topK)
      .forEach((candidate) => allowedPairs.add(pairKey(index, candidate.index)))
  }
  return allowedPairs
}

function clusterPrimaryIndices(indices, decisions, allowedPairs) {
  let clusters = indices.map((index) => [index])
  const acceptedEdges = []
  const mergeEdges = [...allowedPairs]
    .map((key) => {
      const [left, right] = key.split(':').map(Number)
      return { left, right, decision: decisions.get(key) }
    })
    .filter((edge) => edge.decision?.merge)
    .sort((left, right) => right.decision.semanticScore - left.decision.semanticScore)

  for (const edge of mergeEdges) {
    const leftClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.left))
    const rightClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.right))
    if (leftClusterIndex === rightClusterIndex) continue
    const leftCluster = clusters[leftClusterIndex]
    const rightCluster = clusters[rightClusterIndex]
    const completeLinkPass = leftCluster.every((left) =>
      rightCluster.every((right) => decisions.get(pairKey(left, right))?.merge),
    )
    if (!completeLinkPass) continue
    clusters = clusters.filter((_, index) => index !== leftClusterIndex && index !== rightClusterIndex)
    clusters.push([...leftCluster, ...rightCluster])
    acceptedEdges.push(edge)
  }

  clusters.sort((left, right) => Math.min(...left) - Math.min(...right))
  return { clusters, acceptedEdges }
}

function classifySupportingRelation(supportingItem, primaryItem, decision, profile, options) {
  const sharedAnchors = sharedSupportAnchors(supportingItem, primaryItem)
  const blockers = []
  if (!decision) blockers.push('missing-pair-decision')
  if (decision?.hoursApart !== null && decision?.hoursApart > options.maxPairHours) blockers.push('time-window')
  if (decision?.sameSource) blockers.push('same-source-protection')
  if (decision?.conflictingTitleYears) blockers.push('title-year-conflict')
  if (decision?.conflictingTitleEventKinds) blockers.push('title-event-conflict')

  const hardBlocked = blockers.length > 0
  const enoughAnchors = sharedAnchors.length >= 2
  const hybridEvidence = Boolean(decision?.merge)
  const semanticEvidence = decision?.semanticScore >= options.semanticThreshold && (
    decision.lexicalScore >= 0.06 ||
    decision.rareTokens.length >= 1 ||
    decision.sharedEventKinds.length >= 1
  )
  const containmentEvidence = decision?.semanticScore >= options.supportingSemanticThreshold && sharedAnchors.length >= 3 && decision.lexicalScore >= 0.04
  const attach = !hardBlocked && enoughAnchors && (hybridEvidence || semanticEvidence || containmentEvidence)
  const evidence = hybridEvidence
    ? 'existing-hybrid-edge'
    : semanticEvidence
      ? 'semantic+central-anchors'
      : containmentEvidence
        ? 'containment+central-anchors'
        : 'insufficient-supporting-evidence'

  return {
    role: attach ? SOURCE_ROLES.SUPPORTING : SOURCE_ROLES.UNRELATED,
    attach,
    reason: attach ? `${profile.kind}:${evidence}` : blockers[0] || evidence,
    profileKind: profile.kind,
    semanticScore: decision?.semanticScore ?? 0,
    titleSemanticScore: decision?.titleSemanticScore ?? null,
    lexicalScore: decision?.lexicalScore ?? 0,
    rareTokens: decision?.rareTokens || [],
    sharedAnchors,
    blockers,
  }
}

export function clusterItemsV2WithRoles(items, vectors, overrides = {}) {
  const base = clusterItemsV2(items, vectors, overrides)
  const options = base.options
  const sourceProfiles = items.map((item) => classifyEditorialSource(item))
  const primaryIndices = sourceProfiles
    .map((profile, index) => profile.role === SOURCE_ROLES.PRIMARY ? index : null)
    .filter((index) => index !== null)
  const supportingIndices = sourceProfiles
    .map((profile, index) => profile.role === SOURCE_ROLES.SUPPORTING ? index : null)
    .filter((index) => index !== null)
  const primaryCandidatePairs = selectCandidatePairsForIndices(primaryIndices, base.pairDecisions, options)
  const primary = clusterPrimaryIndices(primaryIndices, base.pairDecisions, primaryCandidatePairs)

  const primaryClusters = primary.clusters.map((members) => ({
    ids: members.map((index) => items[index].id),
    items: members.map((index) => items[index]),
    memberIndices: members,
    merges: primary.acceptedEdges
      .filter((edge) => members.includes(edge.left) && members.includes(edge.right))
      .map((edge) => ({
        leftId: items[edge.left].id,
        rightId: items[edge.right].id,
        ...edge.decision,
      })),
    supporting: [],
  }))

  const supportRelations = []
  const attachedSupportingIndices = new Set()
  for (const supportingIndex of supportingIndices) {
    const profile = sourceProfiles[supportingIndex]
    for (let clusterIndex = 0; clusterIndex < primaryClusters.length; clusterIndex += 1) {
      const cluster = primaryClusters[clusterIndex]
      if (cluster.memberIndices.length < options.minPrimarySourcesForSupporting) continue
      const memberRelations = cluster.memberIndices
        .map((primaryIndex) => ({
          primaryIndex,
          ...classifySupportingRelation(
            items[supportingIndex],
            items[primaryIndex],
            base.pairDecisions.get(pairKey(supportingIndex, primaryIndex)),
            profile,
            options,
          ),
        }))
        .sort((left, right) => Number(right.attach) - Number(left.attach) || right.semanticScore - left.semanticScore)
      const best = memberRelations[0]
      const relation = {
        supportingId: items[supportingIndex].id,
        primaryClusterIndex: clusterIndex,
        matchedPrimaryId: best ? items[best.primaryIndex].id : null,
        ...(best || { role: SOURCE_ROLES.UNRELATED, attach: false, reason: 'no-primary-members' }),
      }
      supportRelations.push(relation)
      if (!relation.attach) continue
      attachedSupportingIndices.add(supportingIndex)
      cluster.supporting.push({
        item: items[supportingIndex],
        profile,
        relation,
      })
    }
  }

  const standaloneSources = [
    ...primaryClusters
      .filter((cluster) => cluster.memberIndices.length === 1)
      .map((cluster) => ({
        item: cluster.items[0],
        profile: sourceProfiles[cluster.memberIndices[0]],
        role: SOURCE_ROLES.PRIMARY,
        reason: 'no-primary-complete-link-match',
      })),
    ...supportingIndices
      .filter((index) => !attachedSupportingIndices.has(index))
      .map((index) => ({
        item: items[index],
        profile: sourceProfiles[index],
        role: SOURCE_ROLES.SUPPORTING,
        reason: 'no-qualified-primary-cluster',
      })),
  ]

  return {
    ...base,
    sourceProfiles,
    primaryClusters,
    eventClusters: primaryClusters.filter((cluster) => cluster.ids.length >= 2),
    supportingSources: supportingIndices.map((index) => ({ item: items[index], profile: sourceProfiles[index] })),
    supportRelations,
    standaloneSources,
    primaryCandidatePairs,
  }
}
