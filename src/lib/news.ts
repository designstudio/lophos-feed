import { NewsItem, NewsSource, ArticleSection } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!

export const CACHE_TTL_MINUTES = 120

const LOW_QUALITY_DOMAINS = [
  'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'twitch.tv', 'tiktok.com', 'discord.com',
  'fandom.com', 'wikia.com', 'forums.', 'forum.',
  'mobafire.com', 'op.gg', 'u.gg', 'lolalytics.com',
]

const GENERIC_PATTERNS = [
  /\/(tag|tags|category|categories|topic|topics|section|search|archive|label)\//i,
  /\/(news|articles|latest|all|feed)\/(\?.*)?$/i,
  /[?&]page=\d/i,
  /\/(author|autores?)\//i,
]

function isArticleUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.pathname.length < 10) return false
    if (LOW_QUALITY_DOMAINS.some(d => u.hostname.includes(d))) return false
    return !GENERIC_PATTERNS.some(p => p.test(url))
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
    return 'Dot Esports, The Esports Observer, Liquipedia, HLTV, VLR.gg'
  return 'Reuters, AP, BBC, The Guardian'
}

// ─── Extract og:image from article URL ───────────────────────
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    // Read only first 50KB — og:image is always in <head>
    const reader = res.body?.getReader()
    if (!reader) return null
    let html = ''
    while (html.length < 50000) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
      if (html.includes('</head>')) break
    }
    reader.cancel()

    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)

    const imageUrl = match?.[1]
    if (!imageUrl) return null
    return new URL(imageUrl, url).href
  } catch {
    return null
  }
}

// ─── Cosine similarity ────────────────────────────────────────
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0
}

// ─── Embed titles for clustering ──────────────────────────────
async function embedTitles(titles: string[]): Promise<(number[] | null)[]> {
  return Promise.all(titles.map(async (title) => {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: title }] },
          }),
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) return null
      const data = await res.json()
      return data.embedding?.values ?? null
    } catch { return null }
  }))
}

// ─── Cluster and deduplicate results ─────────────────────────
async function clusterAndDedup(results: any[]): Promise<any[]> {
  if (results.length <= 2) return results

  const embeddings = await embedTitles(results.map(r => r.title))
  const used = new Set<number>()
  const output: any[] = []

  for (let i = 0; i < results.length; i++) {
    if (used.has(i)) continue
    used.add(i)

    // Find all similar results
    const cluster = [results[i]]
    if (embeddings[i]) {
      for (let j = i + 1; j < results.length; j++) {
        if (used.has(j)) continue
        // Also check title similarity without embedding as fallback
        const sim = embeddings[j]
          ? cosineSim(embeddings[i]!, embeddings[j]!)
          : 0
        if (sim > 0.80) {
          cluster.push(results[j])
          used.add(j)
        }
      }
    }

    // Keep highest-scored result from cluster, merge sources info
    const best = cluster.reduce((b, r) => (r.score ?? 0) > (b.score ?? 0) ? r : b)
    // Attach all cluster URLs so Gemini gets context from all sources
    best._clusterUrls = cluster.map(r => r.url)
    output.push(best)
  }

  return output
}

// ─── Main ─────────────────────────────────────────────────────
export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = []
): Promise<NewsItem[]> {
  const today = new Date().toISOString().split('T')[0]

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:      TAVILY_KEY,
      query:        `${topic} news`,
      search_depth: 'advanced',
      days:         3,
      max_results:  10,
      include_answer:      false,
      include_raw_content: false,
      include_images:      false,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()

  const rawResults = (tavilyData.results || []).filter((r: any) =>
    r.url && r.title && r.content?.length > 100 && isArticleUrl(r.url)
  )
  if (rawResults.length === 0) return []

  // Cluster similar stories — removes duplicates before sending to Gemini
  const results = await clusterAndDedup(rawResults)

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const context = results.map((r: any, i: number) =>
    `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 600)}`
  ).join('\n\n')

  const sourceHint = getSourceHint(topic)
  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Você é um editor sênior de um feed de notícias estilo Perplexity Discover.

Hoje é ${todayFormatted}. Tópico: "${topic}".
${existingContext}
REGRAS OBRIGATÓRIAS:
1. Use APENAS as fontes fornecidas. NÃO invente fatos.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. IGNORE resultados que não são notícias reais: guias, fóruns, wikis, apostas.
4. Só crie notícias sobre eventos noticiáveis reais.
5. Se não houver evento noticiável, retorne [].
6. Se todos os eventos já foram cobertos, retorne [].
7. Tom de referência: ${sourceHint}. Escreva em pt-BR.

ESTRUTURA:
[{"title":"...","summary":"...","sections":[{"heading":"...","body":"..."}],"conclusion":"...","sourceIndexes":[1,2]}]

Responda APENAS com JSON válido.

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

  if (!geminiRes.ok) throw new Error(`Gemini error: ${geminiRes.status}`)
  const geminiData = await geminiRes.json()
  const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0])
  const now = new Date().toISOString()

  return Promise.all(parsed.map(async (item: any, i: number): Promise<NewsItem> => {
    const idxs: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = idxs
      .filter(idx => idx >= 0 && idx < results.length)
      .map(idx => {
        const r = results[idx]
        return {
          name:    new URL(r.url).hostname.replace('www.', ''),
          url:     r.url,
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    // Extract og:image from primary source
    const primaryResult = results[idxs[0]] ?? results[0]
    const imageUrl = primaryResult?.url
      ? await extractOgImage(primaryResult.url)
      : null

    return {
      id:          crypto.randomUUID(),
      topic,
      title:       item.title,
      summary:     item.summary,
      sections:    (item.sections || []) as ArticleSection[],
      conclusion:  typeof item.conclusion === 'string' ? item.conclusion : undefined,
      sources,
      imageUrl:    imageUrl ?? undefined,
      publishedAt: now,
      cachedAt:    now,
    }
  }))
}

export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
