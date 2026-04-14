import crypto from 'crypto'

const HARD_BLOCK_PATTERNS = [
  /\bcasino(s)?\b/i,
  /\bcassino(s)?\b/i,
  /\bgambling\b/i,
  /\bbet(ting)?\b/i,
  /\bapostas?\b/i,
  /\bslots?\b/i,
  /\bpoker\b/i,
  /\broulette\b/i,
  /\broleta\b/i,
  /\bjackpot\b/i,
  /\bbonus\b/i,
  /\bb[oô]nus\b/i,
  /\bno deposit\b/i,
  /\bsem dep[oó]sito\b/i,
  /\bsweepstakes?\b/i,
  /\bbookmaker\b/i,
  /\bcassino online\b/i,
]

const DEAL_HINT_PATTERNS = [
  /\bdesconto\b/i,
  /\bdescontos\b/i,
  /\bpromo(cao|ção|coes|ções)\b/i,
  /\boferta(s)?\b/i,
  /\bcupom(ns)?\b/i,
  /\bcoupon(s)?\b/i,
  /\bblack friday\b/i,
  /\bdeal(s)?\b/i,
  /\bliquida(cao|ção)\b/i,
  /\bfrete gr[aá]tis\b/i,
  /\bgr[aá]tis\b/i,
  /\beconomize\b/i,
  /\bimperd[ií]vel\b/i,
  /\bmais barato\b/i,
  /\bmenor pre[cç]o\b/i,
  /\bpre[cç]o baixo\b/i,
  /\bpor r\$/i,
  /\bpor us\$/i,
  /\b\d{1,3}%\s*(off|de desconto)\b/i,
]

const DEAL_SOURCE_HINTS = [
  'promobit',
  'pelando',
  'buscape',
  'zoom.com',
  'cuponomia',
  'meliuz',
]

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

export function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function canonicalizeUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''

    for (const param of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'fbclid',
      'gclid',
      'msclkid',
      'twclid',
      'dclid',
      'zanpid',
      'rdid',
    ]) {
      parsed.searchParams.delete(param)
    }

    return parsed.toString()
  } catch {
    return String(url || '')
  }
}

export function createDedupHash(title) {
  return crypto.createHash('md5').update(normalizeText(title)).digest('hex')
}

export function tokenize(value) {
  return normalizeText(value).split(' ').filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

export function strongTokenize(value) {
  return normalizeText(value).split(' ').filter((word) => word.length >= 5 && !STOPWORDS.has(word))
}

export function jaccardScore(a, b) {
  const aSet = new Set(tokenize(a))
  const bSet = new Set(tokenize(b))

  if (aSet.size === 0 && bSet.size === 0) return 1
  if (aSet.size === 0 || bSet.size === 0) return 0

  let intersection = 0
  for (const word of aSet) {
    if (bSet.has(word)) intersection++
  }

  const union = aSet.size + bSet.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function textOverlapScore(a, b) {
  return jaccardScore(a, b)
}

export function strongIntersection(a, b) {
  const aSet = new Set(strongTokenize(a))
  const bSet = new Set(strongTokenize(b))
  const common = []

  for (const word of aSet) {
    if (bSet.has(word)) common.push(word)
  }

  return common
}

export function shouldMergeTexts(a, b, { similarityThreshold = 0.3, minStrongTokens = 3 } = {}) {
  const score = textOverlapScore(a, b)
  const strong = strongIntersection(a, b)
  return {
    merge: score >= similarityThreshold && strong.length >= minStrongTokens,
    score,
    strong,
  }
}

export function shouldRejectPreflightItem({ title, description = '', url = '', sourceName = '' }) {
  const haystack = [title, description, url, sourceName]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()

  if (countMatches(haystack, HARD_BLOCK_PATTERNS) >= 1) {
    return { reject: true, reason: 'blocked-gambling' }
  }

  const dealSignals = countMatches(haystack, DEAL_HINT_PATTERNS)
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => haystack.includes(hint))

  if (dealSignals >= 2 || (dealSignals >= 1 && sourceLooksPromo)) {
    return { reject: true, reason: 'blocked-deal' }
  }

  return { reject: false, reason: null }
}

export function buildPreflightKey(item) {
  const canonicalUrl = canonicalizeUrl(item.url)
  const titleHash = createDedupHash(item.title)
  return `${canonicalUrl}::${titleHash}`
}

export function buildHistoryKey(item) {
  const canonicalUrl = canonicalizeUrl(item.url)
  const titleHash = item.dedup_hash || createDedupHash(item.title)
  return `${canonicalUrl}::${titleHash}`
}

export function preflightRawItems(items, historyKeys = new Set()) {
  const accepted = []
  const rejected = []
  const duplicateIds = []
  const seenKeys = new Set()

  for (const item of items) {
    const decision = shouldRejectPreflightItem({
      title: item.title,
      description: item.content || item.summary || '',
      url: item.url,
      sourceName: item.source_name || '',
    })

    if (decision.reject) {
      rejected.push({
        id: item.id,
        reason: decision.reason,
        title: item.title,
      })
      continue
    }

    const key = buildPreflightKey(item)
    if (seenKeys.has(key) || historyKeys.has(key)) {
      duplicateIds.push(item.id)
      continue
    }

    seenKeys.add(key)
    accepted.push(item)
  }

  return {
    accepted,
    rejected,
    duplicateIds,
  }
}

export function clusterDeterministicItems(items, options = {}) {
  const similarityThreshold = options.similarityThreshold ?? 0.3
  const minStrongTokens = options.minStrongTokens ?? 3

  const clusters = []

  for (const item of items) {
    const itemText = `${item.title || ''} ${item.content || ''}`
    let bestCluster = null
    let bestScore = 0

    for (const cluster of clusters) {
      const clusterText = cluster.items
        .map((clusterItem) => `${clusterItem.title || ''} ${clusterItem.content || ''}`)
        .join(' \n ')

      const score = textOverlapScore(itemText, clusterText)
      if (score < similarityThreshold) continue

      const strong = strongIntersection(itemText, clusterText)
      if (strong.length < minStrongTokens) continue

      if (score > bestScore) {
        bestScore = score
        bestCluster = cluster
      }
    }

    if (bestCluster) {
      bestCluster.items.push(item)
    } else {
      clusters.push({ items: [item] })
    }
  }

  return clusters
    .map((cluster) => cluster.items.map((item) => item.id))
    .filter((cluster) => cluster.length > 0)
}

export function summarizePreflightByTopic(items) {
  return summarizePreflightByTopicWithHistory(items, new Set())
}

export function summarizePreflightByTopicWithHistory(items, historyKeys = new Set()) {
  const byTopic = new Map()

  for (const item of items) {
    const topic = item.topic || 'sem-topico'
    const bucket = byTopic.get(topic) || []
    bucket.push(item)
    byTopic.set(topic, bucket)
  }

  return Array.from(byTopic.entries())
    .map(([topic, topicItems]) => {
      const { accepted, rejected, duplicateIds } = preflightRawItems(topicItems, historyKeys)

      return {
        topic,
        total: topicItems.length,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        duplicateCount: duplicateIds.length,
        acceptedIds: accepted.map((item) => item.id),
        rejected,
        duplicateIds,
      }
    })
    .sort((a, b) => a.topic.localeCompare(b.topic))
}
