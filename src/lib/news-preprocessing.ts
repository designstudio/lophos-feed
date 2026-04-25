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

export function extractText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const text = record['#text']
    return typeof text === 'string' ? text : ''
  }
  return String(value)
}

export function stripHtml(html: unknown): string {
  const text = extractText(html)
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

export function canonicalizeUrl(url: string): string {
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
    return url
  }
}

export function createDedupHash(title: string): string {
  const normalized = title.toLowerCase().trim()
  return crypto.createHash('md5').update(normalized).digest('hex')
}

export function buildFaviconUrl(sourceUrl: string): string {
  return `https://www.google.com/s2/favicons?domain=${sourceUrl}&sz=32`
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

export function isLikelyStaleLaunchArticle({
  title = '',
  description = '',
  sourceName = '',
  topic = '',
}: {
  title?: string
  description?: string
  sourceName?: string
  topic?: string
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

export function shouldRejectRawItem({
  title,
  description = '',
  url = '',
  sourceName = '',
  sections = [],
  rawTexts = [],
}: {
  title?: string
  description?: string
  url?: string
  sourceName?: string
  sections?: Array<{ heading?: string; body?: string }>
  rawTexts?: string[]
}) {
  const sectionText = Array.isArray(sections)
    ? sections.map((section) => `${section?.heading || ''} ${section?.body || ''}`).join(' \n ')
    : ''
  const haystack = [title, description, sectionText, ...rawTexts, url, sourceName].filter(Boolean).join(' \n ').toLowerCase()

  if (countMatches(haystack, ARCHIVE_HINT_PATTERNS) >= 1) {
    return { reject: true, reason: 'blocked-archive' as const }
  }

  if (
    isLikelyStaleLaunchArticle({
      title,
      description,
      sourceName,
    })
  ) {
    return { reject: true, reason: 'blocked-stale-launch' as const }
  }

  const gamblingSignals = countMatches(haystack, HARD_BLOCK_PATTERNS)
  const gamblingContextSignals = countMatches(haystack, GAMBLING_CONTEXT_PATTERNS)

  if (gamblingSignals >= 2 || (gamblingSignals >= 1 && gamblingContextSignals >= 1)) {
    return { reject: true, reason: 'blocked-gambling' as const }
  }

  const dealSignals = countMatches(haystack, DEAL_HINT_PATTERNS)
  const listicleSignals = countMatches(haystack, LISTICLE_HINT_PATTERNS)
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => haystack.includes(hint))

  if (dealSignals >= 2 || (dealSignals >= 1 && (sourceLooksPromo || listicleSignals >= 1))) {
    return { reject: true, reason: 'blocked-deal' as const }
  }

  return { reject: false, reason: null }
}
