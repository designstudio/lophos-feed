import { randomUUID } from 'crypto'
import { NewsItem, NewsSource, ArticleSection } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!

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

// Extract og:image from a URL — used as fallback when Tavily has no image
// Fallback: use Tavily Extract to get og:image from sites that block direct fetch (Forbes, Bloomberg, etc.)
async function fetchOgImageViaTavily(url: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_KEY, urls: [url] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const data = await res.json()
    const raw = data?.results?.[0]?.raw_content ?? ''
    const match =
      raw.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      raw.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      raw.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    const imageUrl = match?.[1]
    if (!imageUrl) return undefined
    try { return new URL(imageUrl, url).href } catch { return imageUrl }
  } catch {
    return undefined
  }
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
    try { return new URL(imageUrl, url).href } catch { return imageUrl }
  } catch {
    return undefined
  }
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
  // Layer 2: Tavily Extract fallback
  for (const s of sources) {
    if (s?.url) {
      const cached = imageCache.get(s.url)
      if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL_MS) {
        if (cached.url) return cached.url
        continue
      }
      const img = await fetchOgImageViaTavily(s.url)
      imageCache.set(s.url, { url: img, ts: Date.now() })
      if (img) return img
    }
  }
  return undefined
}

function buildQuery(topic: string): string {
  const todayISO = new Date().toISOString().split('T')[0]
  // Add "news" explicitly and today's date to force recency
  return `"${topic}" news ${todayISO}`
}

export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = []
): Promise<NewsItem[]> {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: buildQuery(topic),
      search_depth: 'advanced', // better quality results
      max_results: 10,
      days: 2,
      include_answer: false,
      include_raw_content: false,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()

  // Filter — keep only real articles from quality domains
  const results = (tavilyData.results || []).filter((r: any) =>
    r.url && r.title && r.content && r.content.length > 100 && isArticleUrl(r.url)
  )

  if (results.length === 0) return []

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const context = results
    .map((r: any, i: number) =>
      `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 600)}`
    )
    .join('\n\n')

  const sourceHint = getSourceHint(topic)

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita estes eventos):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Você é um editor sênior de um feed de notícias estilo Perplexity Discover: notícias frescas, curtas, impactantes.

Hoje é ${today}. Tópico: "${topic}".
${existingContext}
REGRAS OBRIGATÓRIAS:
1. Use APENAS as fontes fornecidas. NÃO invente fatos.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. IGNORE resultados que não são notícias reais: guias de meta, streamers aleatórios, fóruns, wikis, apostas, resultados de quiz/LoLdle.
4. Só crie notícias sobre eventos noticiáveis: partidas, patches, anúncios oficiais, resultados de torneios, novidades do jogo.
5. Se não houver nenhum evento noticiável real nas fontes, retorne [].
6. Tom editorial de referência: ${sourceHint}.
7. Tom: neutro, jornalístico, sem clickbait.
8. Se todos os eventos já foram cobertos pelas notícias existentes, retorne [].

ESTRUTURA de cada notícia:
- title: título preciso em pt-BR
- summary: parágrafo introdutório de 4-5 frases, factual e empolgante
- sections: array de 2-4 seções com heading e body
- conclusion: "O que esperar" ou null
- sourceIndexes: índices das fontes usadas

Responda APENAS com JSON válido:
[{"title":"...","summary":"...","sections":[{"heading":"...","body":"..."}],"conclusion":"...","sourceIndexes":[1,2]}]

FONTES:
${context}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )

  if (!geminiRes.ok) {
    console.error(`Gemini error ${geminiRes.status}:`, await geminiRes.text())
    throw new Error(`Gemini error: ${geminiRes.status}`)
  }

  const geminiData = await geminiRes.json()
  const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0])
  const now = new Date().toISOString()

  const items: NewsItem[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    const idxs: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = idxs
      .filter((idx) => idx >= 0 && idx < results.length)
      .map((idx) => {
        const r = results[idx]
        return {
          name: new URL(r.url).hostname.replace('www.', ''),
          url: r.url,
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    // Prefer og:image from the actual sources; fallback to Tavily image if needed
    const primaryResult = results[idxs[0]] ?? results[0]
    const tavilyImage: string | undefined = primaryResult?.image ?? (tavilyData.images?.[idxs[0]] ?? undefined)
    let imageUrl: string | undefined = tavilyImage
    if (!imageUrl || !isImageFromSources(imageUrl, sources)) {
      const ogImage = await fetchImageForSources(sources)
      if (ogImage) imageUrl = ogImage
    }

    const safeId = randomUUID()

    const conclusion = typeof item.conclusion === 'string'
      ? item.conclusion
      : item.conclusion?.body || undefined

    items.push({
      id: safeId,
      topic,
      title: item.title,
      summary: item.summary,
      sections: (item.sections || []) as ArticleSection[],
      conclusion,
      sources,
      imageUrl,
      publishedAt: now,
      cachedAt: now,
    })
  }

  return items
}

export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
