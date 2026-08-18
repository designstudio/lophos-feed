import crypto from 'crypto'

const HARD_BLOCK_PATTERNS = [
  /\bcasino(s)?\b/i,
  /\bcassino(s)?\b/i,
  /\bgambling\b/i,
  /\bpoker\b/i,
  /\broulette\b/i,
  /\broleta\b/i,
  /\bno deposit\b/i,
  /\bsem dep[oó]sito\b/i,
  /\bsweepstakes?\b/i,
  /\bbookmaker\b/i,
  /\bcassino online\b/i,
]

const GAMBLING_TITLE_PATTERNS = [
  /\b(?:online|casino|cassino)\s+slots?\b/i,
  /\bslot machines?\b/i,
  /\b(?:sports?book|betting sites?|sites? de apostas?)\b/i,
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

const STRONG_DEAL_TITLE_PATTERNS = [
  /\b(?:cupom|cupons|coupon|coupons|c[oó]digo promocional)\b/i,
  /\bblack friday\b/i,
  /\b\d{1,3}%\s*(?:off|de desconto)\b/i,
  /\b(?:deal|deals|promo[cç][aã]o|promo[cç][oõ]es)\b.*\b(?:preorder|pre-order|compra|comprar|pre[cç]o|desconto)\b/i,
]

const DEAL_SOURCE_HINTS = [
  'promobit',
  'pelando',
  'buscape',
  'zoom.com',
  'cuponomia',
  'meliuz',
]

const ARCHIVE_TITLE_PATTERNS = [
  /\b(?:retrospectiva|retrospectivas|throwback|relembrando|revisitando)\b/i,
  /\b(?:republicado|republicada|repostado|repostada|originalmente publicado|originally published)\b/i,
  /(?:^|\s[-:|]\s)(?:arquivo|archive)(?:$|\s[-:|]\s)/i,
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
}: {
  title?: string
  description?: string
  sourceName?: string
  topic?: string
}) {
  return ARCHIVE_TITLE_PATTERNS.some((pattern) => pattern.test(title))
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
  const titleText = String(title || '').toLowerCase()
  const bodyText = [description, sectionText, ...rawTexts].filter(Boolean).join(' \n ').toLowerCase()
  const sourceContext = [url, sourceName].filter(Boolean).join(' \n ').toLowerCase()

  if (
    isLikelyStaleLaunchArticle({
      title,
      description,
      sourceName,
    })
  ) {
    return { reject: true, reason: 'blocked-stale-launch' as const }
  }

  const titleForGambling = titleText.replace(/\b(?:roleta russa|russian roulette)\b/gi, '')
  const titleGamblingSignals = countMatches(titleForGambling, HARD_BLOCK_PATTERNS) +
    countMatches(titleForGambling, GAMBLING_TITLE_PATTERNS)
  const bodyGamblingSignals = countMatches(bodyText, HARD_BLOCK_PATTERNS)

  if (
    titleGamblingSignals >= 1 ||
    bodyGamblingSignals >= 2
  ) {
    return { reject: true, reason: 'blocked-gambling' as const }
  }

  const titleDealSignals = countMatches(titleText, DEAL_HINT_PATTERNS)
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => sourceContext.includes(hint))
  const strongDealTitle = STRONG_DEAL_TITLE_PATTERNS.some((pattern) => pattern.test(titleText))

  if (strongDealTitle || titleDealSignals >= 3 || (sourceLooksPromo && titleDealSignals >= 1)) {
    return { reject: true, reason: 'blocked-deal' as const }
  }

  return { reject: false, reason: null }
}
