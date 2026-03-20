import { NewsItem, NewsSource, ArticleSection } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!

export const CACHE_TTL_MINUTES = 120

const GENERIC_PATTERNS = [
  /\/(tag|tags|category|categories|topic|topics|section|search|archive|label)\//i,
  /\/(news|articles|latest|all|feed)\/?(\?.*)?$/i,
  /[?&]page=\d/i,
  /\/(author|autores?)\//i,
]

function isArticleUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    if (path.length < 10) return false
    return !GENERIC_PATTERNS.some((p) => p.test(url))
  } catch { return false }
}

// Source guidance by topic category
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
  if (/esport|valorant|league|lol|overwatch|gaming|game/.test(t))
    return 'IGN, Kotaku, PC Gamer, Dot Esports, The Gamer'
  return 'Reuters, AP, BBC, The Guardian'
}

export async function fetchNewsForTopic(topic: string): Promise<NewsItem[]> {
  const todayISO = new Date().toISOString().split('T')[0]
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: `${topic} ${todayISO}`,
      search_depth: 'basic',
      max_results: 10,
      days: 3,
      include_answer: false,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()
  const images: string[] = tavilyData.images || []

  const results = (tavilyData.results || []).filter((r: any) =>
    r.url && r.title && isArticleUrl(r.url)
  )

  if (results.length === 0) return []

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // Richer snippets for section-level synthesis
  const context = results
    .map((r: any, i: number) =>
      `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 600)}`
    )
    .join('\n\n')

  const sourceHint = getSourceHint(topic)

  const prompt = `Você é um editor sênior de um feed de notícias estilo Perplexity Discover: notícias frescas, curtas, impactantes, multi-tópico.

Hoje é ${today}. Tópico: "${topic}".

REGRAS OBRIGATÓRIAS:
1. Use APENAS as fontes fornecidas abaixo — não invente ou substitua por outras.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. NÃO invente fatos. Se informação insuficiente, foque no confirmado ou escreva "ainda sem confirmação oficial".
4. Cruzar múltiplas fontes — mencionar divergências quando existirem.
5. Tom editorial de referência para este tópico: ${sourceHint}. Use isso apenas como referência de nível de rigor e estilo — não como lista restrita de fontes.
6. Tom: neutro, jornalístico, empolgante. Sem clickbait.

ESTRUTURA OBRIGATÓRIA de cada notícia:
- title: título principal direto e preciso em pt-BR
- summary: parágrafo introdutório completo (4-5 frases) — o que aconteceu, quando, quem está envolvido, repercussão inicial. Tom empolgante e factual.
- sections: array de 2-4 seções temáticas, cada uma com:
  - heading: subtítulo curto e chamativo (ex: "Detalhes do anúncio", "Reação dos fãs", "Impacto no mercado")
  - body: 2-4 frases factuais sintetizando informações específicas das fontes
- conclusion: seção final opcional (2-4 linhas) com título "O que esperar", "Contexto maior" ou "Próximos passos" — só inclua se houver informação relevante
- sourceIndexes: índices de todos os resultados usados

Responda APENAS com JSON válido:
[{
  "title": "...",
  "summary": "...",
  "sections": [{"heading": "...", "body": "..."}, ...],
  "conclusion": "..." ,
  "sourceIndexes": [1, 2, 3]
}]

FONTES:
${context}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
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

  return parsed.map((item: any, i: number): NewsItem => {
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

    const safeId = `${topic}-${Date.now()}-${i}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)

    return {
      id: safeId,
      topic,
      title: item.title,
      summary: item.summary,
      sections: (item.sections || []) as ArticleSection[],
      conclusion: item.conclusion || undefined,
      sources,
      imageUrl: images[i] ?? undefined,
      publishedAt: now,
      cachedAt: now,
    }
  })
}

export function isCacheStale(cachedAt: string): boolean {
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MINUTES * 60 * 1000
}
