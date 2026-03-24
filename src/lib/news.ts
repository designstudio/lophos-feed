import { randomUUID } from 'crypto'
import { NewsItem, NewsSource, ArticleSection } from './types'
import { getSupabaseAdmin } from './supabase'

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

// [DEPRECATED] Tavily integration removed - replaced with RSS
export async function collectRawForTopic(topic: string): Promise<TavilyResult[]> {
  console.warn(`[news] collectRawForTopic called but Tavily has been removed`)
  return []
}

// [DEPRECATED] Tavily integration removed - replaced with RSS
export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = [],
  onDiag?: (stats: { tavily: number; filtered: number; gemini: number; kept: number; dropped: number; rejected?: { url?: string; reason: string }[]; geminiRaw?: string; droppedItems?: { title: string; score: number }[] }) => void
): Promise<NewsItem[]> {
  console.warn(`[news] fetchNewsForTopic called but Tavily has been removed`)
  return []
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
  onDiag?: DiagCallback,
  tavilyImages: string[] = []
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

  const prompt = `Você é um Editor Sênior de um feed de notícias em tempo real no estilo exato do Perplexity Discover: textos curtos, impactantes, bem estruturados, com tom jornalístico empolgado mas factual.

**CONTEXTO ATUAL:**
- Data atual: ${today}
- Tópico principal: "${topic}"
- Conteúdo já publicado: ${existingContext}
- Fontes disponíveis: ${context}

**REGRAS RÍGIDAS:**
- Unicidade de Evento: Cada notícia deve cobrir **apenas UM evento principal** claro e independente. É permitido (e desejado) ter várias seções dentro da mesma notícia falando de aspectos diferentes do MESMO evento (ex: elenco + data de estreia + repercussão). O que é PROIBIDO é misturar eventos completamente diferentes (ex: não colocar notícia de Homem-Aranha junto com American Horror Story ou política no mesmo objeto JSON).
- Foque em anúncios oficiais, lançamentos, patches, revelações de elenco, trailers, resultados importantes, etc. Descarte guias, fóruns, wikis, apostas, quizzes e conteúdo irrelevante.
- Use nomes, números e termos técnicos **exatamente** como aparecem nas fontes (não parafraseie).
- Cruze informações de múltiplas fontes quando possível. Só inclua no sourceIndexes as fontes que realmente tratam do evento.
- **Prevenção de Duplicidade:** Se o evento já consta em \`${existingContext}\`, ignore-o. Se não houver fatos novos ou noticiáveis, retorne apenas \`[]\`.

**Tom e estilo:**
- Empolgado, mas neutro e profissional (estilo Discover).
- Use linguagem fluida.
- Inclua contagem de fontes de forma natural.
- Seja fiel ao conteúdo real das fontes, especialmente ao campo "body" completo quando disponível.

**PROCESSO DE EXECUÇÃO:**
1. **Triagem:** Analise as fontes e identifique eventos independentes.
2. **Verificação de Escopo:** Remova eventos que não sejam notícias reais ou que já foram cobertos.
3. **Redação:** Adote o tom editorial de \`${sourceHint}\` (neutro e jornalístico).
4. **Estruturação JSON:** Formate cada notícia individualmente.

**ESTRUTURA OBRIGATÓRIA (JSON):**
- \`title\`: Título direto em pt-BR com termos literais da fonte.
- \`summary\`: Parágrafo de 4-5 frases incorporando frases diretas das fontes.
- \`sections\`: 2 a 4 objetos com \`heading\` e \`body\`. **IMPORTANTE: Cada seção deve ter conteúdo substancial (3-5 linhas mínimo), não apenas um parágrafo curto.**
- \`conclusion\`: Seção "O que esperar" ou \`null\`.
- \`sourceIndexes\`: Array de inteiros referenciando apenas fontes pertinentes ao evento.

**INSTRUÇÕES DE PROFUNDIDADE:**
- Extraia informações COMPLETAS de cada fonte.
- Não resuma em uma frase; desenvolva a seção com detalhes, contexto e impacto.
- Use citações diretas das fontes quando apropriado.
- Cada seção deve antecipar perguntas que um leitor faria.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON. Se não houver conteúdo válido, retorne \`[]\`.

[{"title":"...","summary":"...","sections":[{"heading":"...","body":"Conteúdo substancial com múltiplas linhas de detalhes..."}],"conclusion":"...","sourceIndexes":[0,1]}]

FONTES:
${context}`

  console.log(`[news] Calling Gemini for topic: ${topic}, with ${results.length} sources`)
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

  console.log(`[news] Gemini response for ${topic}: status=${geminiRes.status}`)
  if (!geminiRes.ok) {
    const errorText = await geminiRes.text()
    console.error(`[news] Gemini error ${geminiRes.status}:`, errorText)
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
    // Último recurso: usar imagens do array top-level do Tavily (geralmente CDN real)
    if (!imageUrl && tavilyImages.length > 0) {
      imageUrl = tavilyImages.find(img => !isLazyLoadImage(img))
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
