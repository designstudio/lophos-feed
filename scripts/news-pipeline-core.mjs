import crypto from 'crypto'

const HARD_BLOCK_PATTERNS = [
  /\bcasino(s)?\b/i,
  /\bcassino(s)?\b/i,
  /\bgambling\b/i,
  /\bslots?\b/i,
  /\bpoker\b/i,
  /\broulette\b/i,
  /\broleta\b/i,
  /\bno deposit\b/i,
  /\bsem dep[oó]sito\b/i,
  /\bsweepstakes?\b/i,
  /\bbookmaker\b/i,
  /\bcassino online\b/i,
]

const GAMBLING_CONTEXT_PATTERNS = [
  /\bbet(ting)?\b/i,
  /\bapostas?\b/i,
  /\bjackpot\b/i,
  /\bbonus\b/i,
  /\bb[oô]nus\b/i,
  /\bsports?book\b/i,
  /\bodd(s)?\b/i,
  /\bodds\b/i,
  /\bprobabilidade(s)?\b/i,
  /\blive bet\b/i,
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

const ARCHIVE_HINT_PATTERNS = [
  /\barquivos?\b/i,
  /\barquivo(s)?\b/i,
  /\barchive(s)?\b/i,
  /\broundup(s)?\b/i,
  /\bcollection\b/i,
]

const LISTICLE_HINT_PATTERNS = [
  /\b\d+\s+(melhores|ofertas|op[çc]oes|opções|produtos|itens|motivos)\b/i,
  /\b(top|ranking|lista|guia|sele(c|ç)(ao|ão))\b/i,
  /\b(confira|check out|veja|clique)\b/i,
]

const LAUNCH_VERB_PATTERNS = [
  /\blan[cç]a\b/i,
  /\blan[cç]ou\b/i,
  /\blan[cç]amento\b/i,
  /\banuncia\b/i,
  /\banunciou\b/i,
  /\bpresenta\b/i,
  /\bapresenta\b/i,
  /\brevela\b/i,
  /\brevelou\b/i,
  /\bestreia\b/i,
  /\bestreou\b/i,
]

const LEGACY_TECH_MARKERS = [
  /\bm1\b/i,
  /\bm2\b/i,
  /\bm3\b/i,
  /\bintel\b/i,
  /\bmacbook air m1\b/i,
  /\biphone 11\b/i,
  /\biphone 12\b/i,
  /\bps4\b/i,
  /\bxbox one\b/i,
]

const LISTICLE_STRONG_TITLE_PATTERNS = [
  /^(?:\d{1,3}|top|ranking)\s+(filmes?|atores?|personagens?|coisas?|motivos?|cenas?|vezes?|erros?|segredos?|curiosidades?|habilidades?|mecanicas?|jogos?|series?|episodios?|looks?)\b/i,
  /^(filmes?|atores?|personagens?|coisas?|motivos?|cenas?|vezes?|erros?|segredos?|curiosidades?|habilidades?|mecanicas?|jogos?|series?|episodios?|looks?)\b.*\bque\b/i,
  /^(?:os|as|um|uma|uns|umas)\s+(filmes?|atores?|personagens?|coisas?|motivos?|cenas?|vezes?|erros?|segredos?|curiosidades?|habilidades?|mecanicas?|jogos?|series?|episodios?|looks?)\b.*\bque\b/i,
]

// Stopwords PT + EN + palavras de formato editorial e plataformas de streaming
const STOPWORDS = new Set([
  // Português — artigos, preposições, pronomes, verbos comuns
  'o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'por','para','com','sem','sob','sobre','entre','ate','apos','que','se','mas','ou','e','ao','aos',
  'eh','esta','este','estes','estas','isso','aqui','la','nao','sim','ja','so','mais','menos',
  'muito','pouco','bem','mal','ainda','agora','quando','como','onde','ser','foi','era','sao',
  'tem','ter','vai','vou','pode','ira','sera','esta','estao','estou','tudo','todos','toda',
  // Inglês — artigos, preposições, auxiliares
  'the','an','of','to','in','for','on','with','at','by','from','up','about','into',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','not','no','or','and','but','if','as',
  'it','its','that','this','they','them','their','there','then','than','so','all',
  'also','just','more','can','we','you','he','she','our','his','her','new',
  // Palavras de formato/editorial
  'estreia','estreias','estreou','lancamento','lancamentos','lanca','lancou',
  'anuncia','anuncio','confirma','confirmado','confirmada','revelado','revelada',
  'revela','veja','assista','saiba','novo','nova','novos','novas','primeiro','primeira',
  'ultimas','ultima','ultimo','noticias','exclusivo','exclusiva','especial',
  'serie','series','filme','filmes','animacao','documentario','temporada',
  'episodio','episodios','parte','capitulo','trailer','review','critica',
  // Plataformas de streaming (evita que "netflix" vire o único token relevante)
  'netflix','disney','hbo','max','prime','amazon','apple','hulu','paramount',
  'peacock','globo','globoplay','youtube','twitch','spotify',
])

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

export function isLikelyStaleLaunchArticle({
  title = '',
  description = '',
  sourceName = '',
  topic = '',
}) {
  const haystack = [title, description, sourceName, topic].filter(Boolean).join(' \n ').toLowerCase()

  if (!haystack.trim()) return false

  const archiveSignal =
    /\b(retrospectiva|retrospectivas|throwback|relembrando|revisitando|republicado|repostado|repost|archive|arquivo|arquivos|originalmente publicado)\b/i.test(haystack)

  const launchSignal = LAUNCH_VERB_PATTERNS.some((pattern) => pattern.test(haystack))
  const legacySignal = LEGACY_TECH_MARKERS.some((pattern) => pattern.test(haystack))
  const techTopic = /\b(tecnologia|tech|gadget|mobile|hardware|apple|android)\b/i.test(haystack)

  return archiveSignal || (techTopic && launchSignal && legacySignal)
}

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function foldText(value) {
  return normalizeText(value)
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

export function shouldRejectPreflightItem({
  title,
  description = '',
  url = '',
  sourceName = '',
  sections = [],
  rawTexts = [],
}) {
  const sectionText = Array.isArray(sections)
    ? sections.map((section) => `${section?.heading || ''} ${section?.body || ''}`).join(' \n ')
    : ''

  const haystack = [title, description, sectionText, ...rawTexts, url, sourceName]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()
  const foldedTitle = foldText(title)

  if (countMatches(haystack, ARCHIVE_HINT_PATTERNS) >= 1) {
    return { reject: true, reason: 'blocked-archive' }
  }

  if (
    isLikelyStaleLaunchArticle({
      title,
      description,
      sourceName,
    })
  ) {
    return { reject: true, reason: 'blocked-stale-launch' }
  }

  const gamblingSignals = countMatches(haystack, HARD_BLOCK_PATTERNS)
  const gamblingContextSignals = countMatches(haystack, GAMBLING_CONTEXT_PATTERNS)

  if (gamblingSignals >= 2 || (gamblingSignals >= 1 && gamblingContextSignals >= 1)) {
    return { reject: true, reason: 'blocked-gambling' }
  }

  const strongListicleTitle = LISTICLE_STRONG_TITLE_PATTERNS.some((pattern) => pattern.test(foldedTitle))
  const dealSignals = countMatches(haystack, DEAL_HINT_PATTERNS)
  const listicleSignals = countMatches(haystack, LISTICLE_HINT_PATTERNS)
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => haystack.includes(hint))
  const hasListicleStructure =
    strongListicleTitle ||
    (listicleSignals >= 2) ||
    (listicleSignals >= 1 && /\b(10|15|20|25|30|50)\b/.test(foldedTitle))

  if (hasListicleStructure) {
    return { reject: true, reason: 'blocked-listicle' }
  }

  if (dealSignals >= 2 || (dealSignals >= 1 && (sourceLooksPromo || listicleSignals >= 1))) {
    return { reject: true, reason: 'blocked-deal' }
  }

  return { reject: false, reason: null }
}

export function buildNewsSourceFromItem(item) {
  const rawUrl = item?.url || item?.source_url || ''
  const canonicalUrl = canonicalizeUrl(rawUrl)
  let hostname = 'source'

  try {
    hostname = new URL(canonicalUrl || rawUrl).hostname.replace(/^www\./, '')
  } catch {
    hostname = String(item?.source_name || 'source').trim() || 'source'
  }

  return {
    name: String(item?.source_name || hostname).trim() || hostname,
    url: canonicalUrl || rawUrl,
    favicon: `https://www.google.com/s2/favicons?domain=${canonicalUrl || rawUrl}&sz=32`,
  }
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

export function buildComparableText(item) {
  return [item.title, item.summary, item.content]
    .filter(Boolean)
    .join(' ')
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

export function findSemanticDuplicateMatches(items, historyItems, options = {}) {
  const similarityThreshold = options.similarityThreshold ?? 0.3
  const minStrongTokens = options.minStrongTokens ?? 3
  const matches = []

  for (const item of items) {
    const itemText = buildComparableText(item)
    if (!itemText.trim()) continue

    let bestMatch = null

    for (const historyItem of historyItems) {
      if (!historyItem || historyItem.id === item.id) continue

      const historyText = buildComparableText(historyItem)
      if (!historyText.trim()) continue

      const score = textOverlapScore(itemText, historyText)
      if (score < similarityThreshold) continue

      const strong = strongIntersection(itemText, historyText)
      if (strong.length < minStrongTokens) continue

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          currentId: item.id,
          historyId: historyItem.id,
          score,
          strong,
          currentTitle: item.title,
          historyTitle: historyItem.title,
          historySource: historyItem.source_name,
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch)
    }
  }

  return matches
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

export function stripEditorialNoise(title) {
  const foldedTitle = foldText(title)
  const noiseTokens = new Set([
    'novo',
    'nova',
    'novos',
    'novas',
    'trailer',
    'teaser',
    'sinopse',
    'data',
    'lanca',
    'lancamento',
    'estreia',
    'estreiam',
    'anuncia',
    'anunci',
    'confirma',
    'divulga',
    'apresenta',
    'mostra',
    'revela',
    'revelado',
    'revelada',
    'ganha',
    'ganham',
    'primeiro',
    'primeira',
    'segundo',
    'segunda',
    'nomeia',
    'nomeado',
    'nomeada',
    'contrata',
    'contratado',
    'contratada',
    'assume',
    'assumir',
    'deixa',
    'deixou',
    'sai',
    'saiu',
    'retorna',
    'retornar',
    'volta',
    'voltar',
    'dirige',
    'dirigido',
    'dirigida',
    'dirigindo',
  ])

  const rawTokens = foldedTitle
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)

  const tokens = []
  for (let index = 0; index < rawTokens.length; index += 1) {
    const fourTokenPhrase = rawTokens.slice(index, index + 4).join(' ')
    const threeTokenPhrase = rawTokens.slice(index, index + 3).join(' ')

    if (
      fourTokenPhrase === 'the texas chainsaw massacre' ||
      fourTokenPhrase === 'o massacre da serra eletrica'
    ) {
      tokens.push('texas', 'chainsaw', 'massacre')
      index += 3
      continue
    }

    if (threeTokenPhrase === 'massacre da serra eletrica') {
      tokens.push('texas', 'chainsaw', 'massacre')
      index += 2
      continue
    }

    const token = rawTokens[index]
    if (token.length >= 3 && !noiseTokens.has(token)) {
      tokens.push(token)
    }
  }

  return tokens
    .join(' ')
    .trim() || foldedTitle
}

export function buildArticleDedupProfile(article) {
  const sectionsText = Array.isArray(article?.sections)
    ? article.sections
        .map((section) => `${section?.heading || ''} ${section?.body || ''}`)
        .join(' ')
    : ''

  const title = String(article?.title || '')
  const summary = String(article?.summary || '')
  const text = [title, summary, sectionsText]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    titleText: normalizeText(title),
    coreTitleText: stripEditorialNoise(title),
    text,
  }
}

export function findBestArticleDuplicateMatch(article, candidates, options = {}) {
  const similarityThreshold = options.similarityThreshold ?? 0.22
  const minStrongTokens = options.minStrongTokens ?? 2
  const minTitleScore = options.minTitleScore ?? 0.4
  const minTitleSharedTokens = options.minTitleSharedTokens ?? 2
  const minCompactTitleScore = options.minCompactTitleScore ?? 0.4
  const minCompactTitleTokens = options.minCompactTitleTokens ?? 2
  const minSupportScore = options.minSupportScore ?? 0.18
  const minSupportTokens = options.minSupportTokens ?? 2

  const sourceProfile = buildArticleDedupProfile(article)
  let bestMatch = null
  let bestScore = 0
  let bestStrong = []

  for (const candidate of candidates || []) {
    if (!candidate || candidate.id === article?.id) continue

    const candidateProfile = candidate._dedupProfile || buildArticleDedupProfile(candidate)

    const sameTitle = sourceProfile.titleText && sourceProfile.titleText === candidateProfile.titleText
    const titleContains =
      sourceProfile.titleText &&
      candidateProfile.titleText &&
      (
        sourceProfile.titleText.includes(candidateProfile.titleText) ||
        candidateProfile.titleText.includes(sourceProfile.titleText)
      )

    const titleScore = textOverlapScore(sourceProfile.titleText, candidateProfile.titleText)
    const titleSharedTokens = strongIntersection(sourceProfile.titleText, candidateProfile.titleText).length
    const coreTitleScore = textOverlapScore(sourceProfile.coreTitleText, candidateProfile.coreTitleText)
    const coreSharedTokens = strongIntersection(sourceProfile.coreTitleText, candidateProfile.coreTitleText).length

    const score = textOverlapScore(sourceProfile.text, candidateProfile.text)
    const strong = strongIntersection(sourceProfile.text, candidateProfile.text)
    const titleStrong = strongIntersection(sourceProfile.titleText, candidateProfile.titleText)

    const verySimilarTitles = titleScore >= minTitleScore && titleSharedTokens >= minTitleSharedTokens
    const verySimilarCoreTitles = coreTitleScore >= minTitleScore && coreSharedTokens >= minTitleSharedTokens

    const headlineMatch =
      sameTitle ||
      titleContains ||
      verySimilarTitles ||
      verySimilarCoreTitles ||
      (titleSharedTokens >= 3 && titleScore >= 0.45)

    const bodyMatch = score >= similarityThreshold && strong.length >= minStrongTokens
    const compactMatch = titleScore >= minCompactTitleScore && titleStrong.length >= minCompactTitleTokens
    const supportMatch =
      headlineMatch && (
        bodyMatch ||
        compactMatch ||
        (score >= minSupportScore && strong.length >= minSupportTokens)
      )

    if (!(bodyMatch || supportMatch)) continue

    if (score > bestScore) {
      bestScore = score
      bestStrong = strong
      bestMatch = {
        candidate,
        score,
        strong,
        titleScore,
        titleSharedTokens,
        coreTitleScore,
        coreSharedTokens,
        sameTitle,
        titleContains,
        verySimilarTitles,
        verySimilarCoreTitles,
        bodyMatch,
        supportMatch,
        compactMatch,
      }
    }
  }

  return bestMatch
    ? {
        ...bestMatch,
        strong: bestStrong,
      }
    : null
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
