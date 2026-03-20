import { NewsItem, NewsSource } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!

export const CACHE_TTL_MINUTES = 120 // 2h — reduz chamadas à API

// Padrões de URLs genéricas (categoria/tag/home) — não são artigos
const GENERIC_PATTERNS = [
  /\/(tag|tags|category|categories|topic|topics|section|search|archive|label)\//i,
  /\/(news|articles|latest|all|feed)\/?(\?.*)?$/i,
  /[?&]page=\d/i,
  /\/(author|autores?)\//i,
]

function isArticleUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname
    // Must have a meaningful path (not just /news/ or /)
    if (path.length < 10) return false
    return !GENERIC_PATTERNS.some((p) => p.test(url))
  } catch {
    return false
  }
}

export async function fetchNewsForTopic(topic: string): Promise<NewsItem[]> {
  // 1. Tavily — só últimos 3 dias, busca artigos específicos
  const todayISO = new Date().toISOString().split('T')[0]
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: `${topic} ${todayISO}`,   // data no query força resultados recentes
      search_depth: 'basic',
      max_results: 10,
      days: 3,                       // só últimos 3 dias
      include_answer: false,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()
  const images: string[] = tavilyData.images || []

  // Filtra só URLs que são artigos reais
  const results = (tavilyData.results || []).filter((r: any) =>
    r.url && r.title && isArticleUrl(r.url)
  )

  if (results.length === 0) return []

  // 2. Contexto rico — snippets maiores para síntese jornalística de qualidade
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const context = results
    .map((r: any, i: number) =>
      `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 400)}`
    )
    .join('\n\n')

  const prompt = `Você é um jornalista sênior. Hoje é ${today}. Analise as fontes abaixo sobre "${topic}" e produza uma síntese jornalística.

INSTRUÇÕES:
1. Agrupe fontes que cobrem o MESMO evento em 1 notícia. Só crie 2 notícias se forem eventos genuinamente distintos.
2. CRUZAMENTO DE FONTES: compare o que cada fonte diz. Se houver divergências ou informações complementares, mencione explicitamente (ex: "Segundo o X, ... já o Y aponta que...").
3. SÍNTESE NARRATIVA: escreva um resumo coeso de 4-5 frases em português, organizado como um parágrafo jornalístico — contexto → fato central → desdobramentos → impacto/reação.
4. Separe fatos confirmados de especulações ("confirmou que..." vs "segundo fontes, pode...").
5. Título direto e preciso, sem clickbait.
6. Se o evento ocorreu hoje ou ontem, indique isso no resumo.

Responda APENAS com JSON válido:
[{
  "title": "título jornalístico preciso em pt-BR",
  "summary": "síntese de 4-5 frases cruzando as fontes, narrativa coesa",
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

  return parsed.map((item: any, i: number): NewsItem => {
    const idxs: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = idxs
      .filter((idx) => idx >= 0 && idx < results.length)
      .map((idx) => {
        const r = results[idx]
        return {
          name: new URL(r.url).hostname.replace('www.', ''),
          url: r.url,                  // URL exata do Tavily — sempre é o artigo
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    // URL-safe ID — no spaces or special chars that break routing
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
