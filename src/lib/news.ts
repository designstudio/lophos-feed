import { randomUUID } from 'crypto'
import { NewsItem, NewsSource, ArticleSection } from './types'
import { getSupabaseAdmin } from './supabase'

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

const LAZY_IMAGE_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif']

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
    if (LAZY_IMAGE_PATTERNS.some(p => imageUrl.toLowerCase().includes(p))) return undefined
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
  // time_range: 'day' already filters by recency — keep query focused on the topic
  return `${topic} news 2026`
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textOverlapScore(a: string, b: string): number {
  const aWords = new Set(normalizeText(a).split(' ').filter(w => w.length >= 3))
  const bWords = new Set(normalizeText(b).split(' ').filter(w => w.length >= 3))
  if (aWords.size === 0 || bWords.size === 0) return 0
  let overlap = 0
  for (const w of aWords) if (bWords.has(w)) overlap++
  return overlap / Math.max(1, Math.min(aWords.size, bWords.size))
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

// Fetches Tavily, filters results, and saves to raw_articles. No Gemini call.
// Used by the collect cron (Phase A).
export async function collectRawForTopic(topic: string): Promise<TavilyResult[]> {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: buildQuery(topic),
      search_depth: 'advanced',
      max_results: 8,
      time_range: 'day',
      topic: 'news',
      include_answer: false,
      include_raw_content: true,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()

  const allResults = (tavilyData.results || [])
  const results: TavilyResult[] = []
  for (const r of allResults) {
    if (!r?.url || !r?.title || !r?.content || r.content.length <= 100) continue
    if (!isArticleUrl(r.url)) continue
    results.push({ url: r.url, title: r.title, content: r.content, image: r.image })
  }

  if (results.length === 0) return []

  const db = getSupabaseAdmin()
  const { error } = await db.from('raw_articles').insert({
    topic,
    tavily_results: results,
    query: buildQuery(topic),
    status: 'raw',
  })
  if (error) console.warn('[news] collectRawForTopic: failed to save raw_articles:', error.message)

  return results
}

// Fetches Tavily + processes with Gemini in one shot. Used by POST /api/feed (on-demand).
export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = [],
  onDiag?: (stats: { tavily: number; filtered: number; gemini: number; kept: number; dropped: number; rejected?: { url?: string; reason: string }[]; geminiRaw?: string; droppedItems?: { title: string; score: number }[] }) => void
): Promise<NewsItem[]> {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: buildQuery(topic),
      search_depth: 'advanced',
      max_results: 8,
      time_range: 'day',
      topic: 'news',
      include_answer: false,
      include_raw_content: true,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()

  const allResults = (tavilyData.results || [])
  const results: TavilyResult[] = []
  const rejected: { url?: string; reason: string }[] = []
  for (const r of allResults) {
    if (!r?.url) { if (rejected.length < 12) rejected.push({ reason: 'missing_url' }); continue }
    if (!r?.title) { if (rejected.length < 12) rejected.push({ url: r.url, reason: 'missing_title' }); continue }
    if (!r?.content) { if (rejected.length < 12) rejected.push({ url: r.url, reason: 'missing_content' }); continue }
    if (r.content.length <= 100) { if (rejected.length < 12) rejected.push({ url: r.url, reason: 'content_too_short' }); continue }
    if (!isArticleUrl(r.url)) { if (rejected.length < 12) rejected.push({ url: r.url, reason: 'non_article_url' }); continue }
    results.push({ url: r.url, title: r.title, content: r.content, image: r.image })
  }

  if (results.length === 0) {
    onDiag?.({ tavily: allResults.length, filtered: 0, gemini: 0, kept: 0, dropped: 0, rejected })
    return []
  }

  const db = getSupabaseAdmin()
  const { error: rawError } = await db.from('raw_articles').insert({
    topic,
    tavily_results: results,
    query: buildQuery(topic),
    status: 'raw',
  })
  if (rawError) console.warn('[news] Failed to save raw_articles:', rawError.message)

  const items = await processRawBatch(topic, results, existingTitles, (batchStats) => {
    onDiag?.({ tavily: allResults.length, filtered: results.length, rejected, ...batchStats })
  })
  return items
}

type DiagCallback = (stats: {
  gemini: number; kept: number; dropped: number
  geminiRaw?: string; droppedItems?: { title: string; score: number }[]
}) => void

// Processes filtered Tavily results through Gemini and returns NewsItems.
// Called by fetchNewsForTopic (on-demand) and processRawFeeds (cron batch).
export async function processRawBatch(
  topic: string,
  results: { url: string; title: string; content: string; image?: string }[],
  existingTitles: string[] = [],
  onDiag?: DiagCallback
): Promise<NewsItem[]> {
  if (results.length === 0) return []

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const context = results
    .map((r, i) =>
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
2. O TÍTULO deve incluir palavras-chave LITERAIS das fontes (nomes de bandas, artistas, eventos, números, datas).
3. O RESUMO deve incorporar frases e termos DIRETOS dos artigos das fontes. Reutilize a linguagem original.
4. **CRÍTICO: CADA NOTÍCIA É SOBRE UM ÚNICO EVENTO**. Não agrupe eventos distintos na mesma notícia. Exemplos:
   - ❌ "Avril Lavigne, Guns N' Roses e Harry Styles anunciam turnês" (3 eventos distintos = criar 3 notícias)
   - ✅ "Avril Lavigne anuncia turnê europeia 2026" (1 evento = 1 notícia)
5. Se há múltiplos eventos nas fontes, crie múltiplas notícias (uma por evento).
6. IGNORE resultados que não são notícias reais: guias de meta, streamers aleatórios, fóruns, wikis, apostas, resultados de quiz/LoLdle.
7. Só crie notícias sobre eventos noticiáveis: partidas, patches, anúncios oficiais, resultados de torneios, novidades do jogo, lançamentos, turnês.
8. Se não houver nenhum evento noticiável real nas fontes, retorne [].
9. Tom editorial de referência: ${sourceHint}.
10. Tom: neutro, jornalístico, sem clickbait.
11. Se todos os eventos já foram cobertos pelas notícias existentes, retorne [].
12. **CRÍTICO: sourceIndexes deve incluir APENAS fontes que realmente falam sobre o assunto da notícia**. Máximo 2 fontes por notícia.
13. Se uma fonte é sobre outro assunto completamente diferente, NÃO inclua seu índice, mesmo que apareça na lista.

EXEMPLOS:

EXEMPLO 1 — SEPARAÇÃO DE EVENTOS:
Se as fontes são:
  [1] "Avril Lavigne announces 2026 European tour dates"
  [2] "Guns N' Roses surprises fans with 2026 Germany dates"
  [3] "Harry Styles reveals 2026 world tour"
Você DEVE criar 3 notícias separadas:
  - Notícia 1: "Avril Lavigne Anuncia Turnê Europeia 2026" [sourceIndexes: [1]]
  - Notícia 2: "Guns N' Roses Anuncia Datas na Alemanha em 2026" [sourceIndexes: [2]]
  - Notícia 3: "Harry Styles Anuncia Turnê Mundial 2026" [sourceIndexes: [3]]

EXEMPLO 2 — VALIDAÇÃO DE SOURCES (MESMA NOTÍCIA):
Se você cria uma notícia sobre "Project Hail Mary box office record" e tem 3 fontes:
  [1] "Project Hail Mary breaks Amazon box office records" ✓ Incluir
  [2] "Project Hail Mary hits $71M opening weekend" ✓ Pode incluir se for MESMA notícia
  [3] "GKIDS Animation Festival Hong Kong" ✗ NÃO incluir (assunto diferente)
Então sourceIndexes seria [1] ou [1,2] se ambas falam da MESMA notícia.

ESTRATÉGIA DE GERAÇÃO:
1. Leia TODAS as fontes primeiro e identifique eventos DISTINTOS
2. Para CADA evento, crie UMA notícia separada
3. Nunca misture múltiplos eventos/artistas/projetos na mesma notícia
4. Máximo 2 fontes por notícia, e APENAS se forem sobre o MESMO evento
5. Se uma fonte é irrelevante ou sobre outro tópico, ignore-a completamente

ESTRUTURA de cada notícia:
- title: título preciso em pt-BR (com nomes/termos das fontes)
- summary: parágrafo introdutório de 4-5 frases, usando linguagem direta das fontes
- sections: array de 2-4 seções com heading e body
- conclusion: "O que esperar" ou null
- sourceIndexes: índices APENAS das fontes que realmente falam sobre o assunto

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
  const rawPreview = raw ? raw.slice(0, 800) : ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) {
    onDiag?.({ gemini: 0, kept: 0, dropped: 0, geminiRaw: rawPreview })
    return []
  }

  let parsed: any[] = []
  try {
    parsed = JSON.parse(match[0])
  } catch {
    onDiag?.({ gemini: 0, kept: 0, dropped: 0, geminiRaw: rawPreview })
    return []
  }
  const now = new Date().toISOString()

  let dropped = 0
  const items: NewsItem[] = []
  const droppedItems: { title: string; score: number }[] = []
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

    const title = item?.title || ''
    const summary = item?.summary || ''
    const genText = `${title} ${summary}`
    const sourceText = sources
      .map((s) => {
        const r = results.find((rr) => rr?.url === s.url)
        return r ? `${r.title || ''} ${r.content || ''}` : ''
      })
      .join(' ')
    const relevanceScore = genText.trim() ? textOverlapScore(genText, sourceText) : 0

    if (!isGeneratedItemRelevant(item, sources, results)) {
      dropped++
      droppedItems.push({ title: item.title || '(sem título)', score: relevanceScore })
      continue
    }

    const primaryResult = results[idxs[0]] ?? results[0]
    let imageUrl: string | undefined = primaryResult?.image
    // Descartar lazy-load placeholders que o Tavily às vezes retorna como imagem
    if (isLazyLoadImage(imageUrl)) imageUrl = undefined
    if (!imageUrl || !isImageFromSources(imageUrl, sources)) {
      const ogImage = await fetchImageForSources(sources)
      if (ogImage) imageUrl = ogImage
    }

    const conclusion = typeof item.conclusion === 'string'
      ? item.conclusion
      : item.conclusion?.body || undefined

    const tavilyRaw = idxs
      .filter((idx) => idx >= 0 && idx < results.length)
      .map((idx) => {
        const r = results[idx]
        return { url: r.url, title: r.title, content: r.content, image: r.image }
      })

    items.push({
      id: randomUUID(),
      topic,
      title: item.title,
      summary: item.summary,
      sections: (item.sections || []) as ArticleSection[],
      conclusion,
      sources,
      imageUrl,
      publishedAt: now,
      cachedAt: now,
      tavilyRaw,
    })
  }

  onDiag?.({ gemini: parsed.length, kept: items.length, dropped, geminiRaw: rawPreview, droppedItems })
  return items
}

export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
