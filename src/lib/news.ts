import { NewsItem, NewsSource } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!
const CACHE_TTL_MINUTES = 30

export async function fetchNewsForTopic(topic: string): Promise<NewsItem[]> {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: `${topic} latest news`,
      search_depth: 'basic',
      max_results: 8,
      include_answer: false,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()
  const results = tavilyData.results || []
  const images: string[] = tavilyData.images || []

  if (results.length === 0) return []

  const context = results
    .map((r: any, i: number) =>
      `[${i + 1}] title: "${r.title}" | source: ${new URL(r.url).hostname.replace('www.','')} | snippet: ${r.content?.slice(0, 300)}`
    )
    .join('\n\n')

  const prompt = `Você é um editor de notícias sênior. Analise os resultados abaixo sobre "${topic}".

REGRA PRINCIPAL: Agrupe TODOS os resultados que falam do MESMO evento em UMA única notícia. Só crie notícias separadas se forem eventos genuinamente diferentes (ex: patch do jogo vs torneio vs novo personagem).

Se todos os resultados cobrirem o mesmo assunto, retorne APENAS 1 notícia.
Retorne no máximo 2 notícias.

Para cada notícia:
- Título claro e único em português
- Resumo de 3-4 frases consolidando informações de TODAS as fontes do grupo
- sourceIndexes com os índices de todos os resultados agrupados

Responda APENAS com JSON válido, sem markdown:
[{"title":"...","summary":"...","sourceIndexes":[1,2,3]}]

Resultados:
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
    const errBody = await geminiRes.text()
    console.error(`Gemini error ${geminiRes.status}:`, errBody)
    throw new Error(`Gemini error: ${geminiRes.status}`)
  }

  const geminiData = await geminiRes.json()
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0])
  const now = new Date().toISOString()

  return parsed.map((item: any, i: number): NewsItem => {
    const indexes: number[] = (item.sourceIndexes || [i + 1]).map((n: number) => n - 1)
    const sources: NewsSource[] = indexes
      .filter((idx: number) => idx >= 0 && idx < results.length)
      .map((idx: number) => {
        const r = results[idx]
        return {
          name: new URL(r.url).hostname.replace('www.', ''),
          url: r.url,
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    return {
      id: `${topic}-${Date.now()}-${i}`,
      topic,
      title: item.title,
      summary: item.summary,
      sources,
      imageUrl: images[i] || undefined,
      publishedAt: now,
      cachedAt: now,
    }
  })
}

export function isCacheStale(cachedAt: string): boolean {
  const age = Date.now() - new Date(cachedAt).getTime()
  return age > CACHE_TTL_MINUTES * 60 * 1000
}
