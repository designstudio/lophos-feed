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

// ─── Cosine similarity for dedup ──────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0))
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0))
  return magA && magB ? dot / (magA * magB) : 0
}

// ─── Quick embedding for clustering (title only, cheap) ───────
async function embedTitle(title: string): Promise<number[] | null> {
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
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.embedding?.values ?? null
  } catch { return null }
}

// ─── Cluster similar results and keep best per cluster ─────────
async function deduplicateResults(results: any[]): Promise<any[]> {
  if (results.length <= 3) return results

  // Generate embeddings for titles
  const embeddings = await Promise.all(
    results.map(r => embedTitle(r.title))
  )

  const used = new Set<number>()
  const clusters: any[][] = []

  for (let i = 0; i < results.length; i++) {
    if (used.has(i)) continue
    const cluster = [results[i]]
    used.add(i)

    if (embeddings[i]) {
      for (let j = i + 1; j < results.length; j++) {
        if (used.has(j) || !embeddings[j]) continue
        const sim = cosineSimilarity(embeddings[i]!, embeddings[j]!)
        if (sim > 0.82) {
          cluster.push(results[j])
          used.add(j)
        }
      }
    }
    clusters.push(cluster)
  }

  // From each cluster, pick the result with highest Tavily score
  return clusters.map(cluster =>
    cluster.reduce((best, r) => (r.score ?? 0) > (best.score ?? 0) ? r : best)
  )
}

// ─── Main fetch function ──────────────────────────────────────
export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = []
): Promise<NewsItem[]> {
  const today = new Date().toISOString().split('T')[0]

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:             TAVILY_KEY,
      query:               `${topic} news ${today}`,
      search_depth:        'advanced',
      topic:               'news',           // força fontes jornalísticas
      time_range:          'week',           // últimos 7 dias
      days:                3,               // preferência por últimos 3 dias
      max_results:         10,
      include_answer:      false,
      include_raw_content: false,
      include_images:      true,            // pede imagens ao Tavily
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()

  // Filter quality articles
  const rawResults = (tavilyData.results || []).filter((r: any) =>
    r.url && r.title && r.content && r.content.length > 100 && isArticleUrl(r.url)
  )

  if (rawResults.length === 0) return []

  // Deduplicate similar stories via embedding clustering
  const results = await deduplicateResults(rawResults)

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
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

Hoje é ${todayFormatted}. Tópico: "${topic}".
${existingContext}
REGRAS OBRIGATÓRIAS:
1. Use APENAS as fontes fornecidas. NÃO invente fatos.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. IGNORE resultados que não são notícias reais: guias de meta, streamers aleatórios, fóruns, wikis, apostas.
4. Só crie notícias sobre eventos noticiáveis: partidas, patches, anúncios oficiais, resultados de torneios, novidades.
5. Se não houver nenhum evento noticiável real, retorne [].
6. Tom editorial de referência: ${sourceHint}.
7. Tom: neutro, jornalístico, sem clickbait. Escreva em pt-BR.
8. Se todos os eventos já foram cobertos, retorne [].

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

  // Build image map from Tavily images (indexed by result position)
  const tavilyImages: string[] = tavilyData.images ?? []

  return parsed.map((item: any, i: number): NewsItem => {
    const idxs: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = idxs
      .filter(idx => idx >= 0 && idx < results.length)
      .map(idx => {
        const r = results[idx]
        return {
          name: new URL(r.url).hostname.replace('www.', ''),
          url:  r.url,
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    // Image priority: Tavily image field on primary result → Tavily images array → null
    const primaryResult = results[idxs[0]] ?? results[0]
    const imageUrl =
      primaryResult?.images?.[0] ??
      primaryResult?.image ??
      tavilyImages[idxs[0]] ??
      tavilyImages[0] ??
      null

    return {
      id:          crypto.randomUUID(),
      topic,
      title:       item.title,
      summary:     item.summary,
      sections:    (item.sections || []) as ArticleSection[],
      conclusion:  typeof item.conclusion === 'string' ? item.conclusion : undefined,
      sources,
      imageUrl,
      publishedAt: now,
      cachedAt:    now,
    }
  })
}

export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
