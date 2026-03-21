import { NewsItem, NewsSource, ArticleSection } from './types'

const ASKNEWS_CLIENT_ID     = process.env.ASKNEWS_CLIENT_ID!
const ASKNEWS_CLIENT_SECRET = process.env.ASKNEWS_CLIENT_SECRET!
const GEMINI_KEY            = process.env.GEMINI_API_KEY!

export const CACHE_TTL_MINUTES = 120

// ─── AskNews OAuth2 token (cached in memory) ──────────────────
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAskNewsToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token
  }
  const res = await fetch('https://auth.asknews.app/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     ASKNEWS_CLIENT_ID,
      client_secret: ASKNEWS_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`AskNews auth error: ${res.status}`)
  const data = await res.json()
  tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return tokenCache.token
}

// ─── Search AskNews ───────────────────────────────────────────
async function searchAskNews(query: string): Promise<any[]> {
  const token = await getAskNewsToken()
  const params = new URLSearchParams({
    query,
    n_articles:   '8',
    return_type:  'dicts',
    method:       'nl',
    hours_back:   '48',
  })
  const res = await fetch(`https://api.asknews.app/v1/news/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`AskNews search error: ${res.status}`)
  const data = await res.json()
  return data.articles ?? []
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

export async function fetchNewsForTopic(
  topic: string,
  existingTitles: string[] = []
): Promise<NewsItem[]> {
  const articles = await searchAskNews(topic)
  if (articles.length === 0) return []

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const context = articles.map((a: any, i: number) =>
    `[${i + 1}] ${a.source_id ?? a.domain ?? 'unknown'} — "${a.eng_title ?? a.title}"\n${(a.summary ?? a.body ?? '').slice(0, 600)}`
  ).join('\n\n')

  const sourceHint = getSourceHint(topic)
  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Você é um editor sênior de um feed de notícias estilo Perplexity Discover.

Hoje é ${today}. Tópico: "${topic}".
${existingContext}
REGRAS OBRIGATÓRIAS:
1. Use APENAS as fontes fornecidas. NÃO invente fatos.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. IGNORE resultados irrelevantes: guias de meta, fóruns, wikis, apostas.
4. Só crie notícias sobre eventos noticiáveis reais.
5. Se não houver evento noticiável, retorne [].
6. Se todos os eventos já foram cobertos, retorne [].
7. Tom de referência: ${sourceHint}.
8. Tom: neutro, jornalístico, sem clickbait. Escreva em pt-BR.

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

  return parsed.map((item: any, i: number): NewsItem => {
    const idxs: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = idxs
      .filter(idx => idx >= 0 && idx < articles.length)
      .map(idx => {
        const a = articles[idx]
        const domain = a.domain ?? a.source_id ?? 'unknown'
        return {
          name: a.source_id ?? domain,
          url:  a.article_url ?? `https://${domain}`,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        }
      })

    // AskNews already provides image_url — no need to scrape
    const primaryArticle = articles[idxs[0]] ?? articles[0]
    const imageUrl = primaryArticle?.image_url ?? primaryArticle?.photo_url ?? undefined

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
