import { NewsItem, NewsSource } from './types'

const TAVILY_KEY = process.env.TAVILY_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!
const CACHE_TTL_MINUTES = 30

export async function fetchNewsForTopic(topic: string): Promise<NewsItem[]> {
  // 1. Search with Tavily
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query: `${topic} latest news`,
      search_depth: 'basic',
      max_results: 6,
      include_answer: false,
      include_images: true,
    }),
  })

  if (!tavilyRes.ok) throw new Error(`Tavily error: ${tavilyRes.status}`)
  const tavilyData = await tavilyRes.json()
  const results = tavilyData.results || []
  const images: string[] = tavilyData.images || []

  if (results.length === 0) return []

  // 2. Build context for Gemini
  const context = results
    .map((r: any, i: number) =>
      `[${i + 1}] title: "${r.title}" | url: ${r.url} | source: ${new URL(r.url).hostname.replace('www.','')} | snippet: ${r.content?.slice(0, 400)}`
    )
    .join('\n\n')

  const prompt = `Você é um editor de notícias. Analise os resultados de busca abaixo sobre "${topic}" e agrupe-os em 2 notícias distintas.

Para cada notícia:
- Agrupe os resultados relacionados ao mesmo evento
- Escreva um título claro em português
- Escreva um resumo de 3-4 frases em português, detalhado e informativo
- Liste TODAS as fontes relevantes daquele grupo

Responda APENAS com JSON válido, sem markdown:
[
  {
    "title": "título em português",
    "summary": "resumo 3-4 frases",
    "sources": [
      {"name": "nome do site", "url": "url completa do artigo"}
    ],
    "primaryUrl": "url do artigo mais relevante"
  }
]

Resultados de busca:
${context}`

console.log('GEMINI_KEY length:', GEMINI_KEY?.length ?? 'UNDEFINED')
  
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
    const errBody = await geminiRes.text()
    console.error('Gemini response:', errBody)
    throw new Error(`Gemini error: ${geminiRes.status}`)
  }

  if (!geminiRes.ok) throw new Error(`Gemini error: ${geminiRes.status}`)
  const geminiData = await geminiRes.json()
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0])
  const now = new Date().toISOString()

  return parsed.map((item: any, i: number): NewsItem => ({
    id: `${topic}-${Date.now()}-${i}`,
    topic,
    title: item.title,
    summary: item.summary,
    sources: (item.sources || []).map((s: any) => ({
      name: s.name,
      url: s.url,
      favicon: `https://www.google.com/s2/favicons?domain=${s.url}&sz=32`,
    })),
    imageUrl: images[i] || undefined,
    publishedAt: now,
    cachedAt: now,
  }))
}

export function isCacheStale(cachedAt: string): boolean {
  const age = Date.now() - new Date(cachedAt).getTime()
  return age > CACHE_TTL_MINUTES * 60 * 1000
}
