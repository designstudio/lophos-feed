import { NewsItem, NewsSource } from './types'
import { getSupabaseAdmin } from './supabase'

export const CACHE_TTL_MINUTES = 120
const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const imageCache = new Map<string, { url?: string; ts: number }>()

// Domains to exclude — low quality sources
const LOW_QUALITY_DOMAINS = [
  'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'twitch.tv', 'tiktok.com', 'discord.com',
  'fandom.com', 'wikia.com', 'wiki.', 'forums.', 'forum.',
  'mobafire.com', 'op.gg', 'u.gg', 'lolalytics.com',
]

const LAZY_IMAGE_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif', 'favicon', '/favicon', 'apple-touch-icon', 'logo-icon']
const TOKEN_EQUIVALENTS = [
  { canonical: 'redesign', variants: ['redesign', 'redesenho', 'visual', 'design', 'look', 'aparencia', 'appearance'] },
  { canonical: 'feedback', variants: ['critica', 'criticas', 'feedback', 'pedido', 'pedidos'] },
]

const GENERIC_PATTERNS = [
  /\/(tag|tags|category|categories|topic|topics|section|search|archive|label)\//i,
  /\/(news|articles|latest|all|feed)\/?(\?.*)?$/i,
  /[?&]page=\d/i,
  /\/(author|autores?)\//i,
]

function isArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.pathname.length < 10) return false
    if (LOW_QUALITY_DOMAINS.some(d => u.hostname.includes(d))) return false
    return !GENERIC_PATTERNS.some((p) => p.test(url))
  } catch { return false }
}

function getSourceHint(topic: string): string {
  const t = topic.toLowerCase()
  if (/cinema|filme|série|entretenimento|music|album|award|oscar|emmy/.test(t))
    return 'Variety, Deadline, Hollywood Reporter, Rolling Stone, Billboard'
  if (/política|governo|eleição|congress|senate|president/.test(t))
    return 'Reuters, AP, CNN, BBC, The Guardian, NYT'
  if (/economia|mercado|finanças|stock|crypto|bitcoin/.test(t))
    return 'Bloomberg, Financial Times, Reuters, WSJ'
  if (/tech|ia|inteligência artificial|startup|software/.test(t))
    return 'TechCrunch, The Verge, Wired, Ars Technica'
  if (/esport|valorant|league|lol|overwatch|gaming|game|tft|teamfight/.test(t))
    return 'Dot Esports, The Esports Observer, Liquipedia, HLTV, VLR.gg, Lolesports'
  return 'Reuters, AP, BBC, The Guardian'
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    // Read up to 100KB — SPAs sometimes have og:image injected further down
    const reader = res.body?.getReader()
    if (!reader) return undefined
    let html = ''
    while (html.length < 100000) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
      // Stop early if we already found og:image (common case)
      if (html.includes('og:image') && html.includes('</head>')) break
    }
    reader.cancel()
    const match =
      // Standard og:image variants
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      // Twitter card variants
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i) ||
      // JSON-LD image (used by SPAs like VCT, Riot)
      html.match(/"image"\s*:\s*[{"[]?\s*"url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i) ||
      // Next.js / Nuxt preloaded image hint
      html.match(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/i)
    const imageUrl = match?.[1]
    if (!imageUrl) return undefined
    if (LAZY_IMAGE_PATTERNS.some(p => imageUrl.toLowerCase().includes(p))) return undefined
    try { return new URL(imageUrl, url).href } catch { return imageUrl }
  } catch {
    return undefined
  }
}

function isLazyLoadImage(url: string | undefined): boolean {
  if (!url) return false
  return LAZY_IMAGE_PATTERNS.some(p => url.toLowerCase().includes(p))
}

function isImageFromSources(imageUrl: string | undefined, sources: NewsSource[]): boolean {
  if (!imageUrl) return false
  try {
    const imgHost = new URL(imageUrl).hostname.replace(/^www\./, '')
    return sources.some((s) => {
      if (!s?.url) return false
      const srcHost = new URL(s.url).hostname.replace(/^www\./, '')
      return imgHost === srcHost || imgHost.endsWith(`.${srcHost}`)
    })
  } catch {
    return false
  }
}
// Exported so PATCH /api/article can re-fetch just the image for a specific article
export async function fetchImageForSources(sources: { url: string }[]): Promise<string | undefined> {
  // Layer 1: direct fetch with real browser UA
  for (const s of sources) {
    if (s?.url) {
      const cached = imageCache.get(s.url)
      if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL_MS) {
        if (cached.url) return cached.url
        continue
      }
      const img = await fetchOgImage(s.url)
      imageCache.set(s.url, { url: img, ts: Date.now() })
      if (img) return img
    }
  }
  // [DEPRECATED] Tavily Extract fallback removed
  return undefined
}

function buildQuery(topic: string): string {
  const t = topic.toLowerCase()

  // Specific queries for gaming/esports topics
  if (/valorant/.test(t)) return 'Valorant esports VCT news 2026'
  if (/league|lol|tft/.test(t)) return 'League of Legends esports LEC news 2026'
  if (/overwatch/.test(t)) return 'Overwatch esports OWL news 2026'

  // Default: topic + news
  return `${topic} news 2026`
}

function normalizeText(s: string): string {
  let normalized = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const { canonical, variants } of TOKEN_EQUIVALENTS) {
    for (const variant of variants) {
      normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'g'), canonical)
    }
  }

  return normalized
}

function textOverlapScore(a: string, b: string): number {
  const aWords = new Set(normalizeText(a).split(' ').filter(w => w.length >= 3))
  const bWords = new Set(normalizeText(b).split(' ').filter(w => w.length >= 3))
  if (aWords.size === 0 || bWords.size === 0) return 0
  let overlap = 0
  for (const w of aWords) if (bWords.has(w)) overlap++
  return overlap / Math.max(1, Math.min(aWords.size, bWords.size))
}

// Detecta se um item gerado é duplicado de um título existente (threshold > 0.5)
export function findDuplicateTitle(generatedTitle: string, existingTitles: { id?: string; title: string }[]): { id?: string; score: number } | null {
  let bestMatch: { id?: string; score: number } | null = null
  const threshold = 0.5

  for (const existing of existingTitles) {
    const score = textOverlapScore(generatedTitle, existing.title)
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: existing.id, score }
    }
  }

  return bestMatch
}

function isGeneratedItemRelevant(item: any, sources: NewsSource[], results: any[]): boolean {
  const title = item?.title || ''
  const summary = item?.summary || ''
  const genText = `${title} ${summary}`
  if (!genText.trim()) return false

  const sourceText = sources
    .map((s) => {
      const r = results.find((rr: any) => rr?.url === s.url)
      return r ? `${r.title || ''} ${r.content || ''}` : ''
    })
    .join(' ')

  const score = textOverlapScore(genText, sourceText)
  return score >= 0.15
}

type TavilyResult = { url: string; title: string; content: string; image?: string }

// [DEPRECATED] Tavily integration removed - replaced with RSS
export async function collectRawForTopic(topic: string): Promise<TavilyResult[]> {
  console.warn(`[news] collectRawForTopic called but Tavily has been removed`)
  return []
}

// [DEPRECATED] Tavily integration removed - replaced with RSS
export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = [],
  onDiag?: (stats: { tavily: number; filtered: number; ai: number; kept: number; dropped: number; rejected?: { url?: string; reason: string }[]; aiRaw?: string; droppedItems?: { title: string; score: number }[] }) => void
): Promise<NewsItem[]> {
  console.warn(`[news] fetchNewsForTopic called but Tavily has been removed`)
  return []
}

type DiagCallback = (stats: {
  ai: number; kept: number; dropped: number
  aiRaw?: string; droppedItems?: { title: string; score: number }[]
}) => void

// Legacy helper kept for compatibility, but the active news pipeline no longer
// uses Groq from this module.
export async function processRawBatch(
  topic: string,
  results: { url: string; title: string; content: string; image?: string; video?: string }[],
  existingTitles: string[] = [],
  onDiag?: DiagCallback,
  tavilyImages: string[] = []
): Promise<NewsItem[]> {
  console.warn(`[news] processRawBatch is deprecated and no longer uses Groq. Returning no items for ${topic}.`)
  onDiag?.({ ai: 0, kept: 0, dropped: 0 })
  return []
}


export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
