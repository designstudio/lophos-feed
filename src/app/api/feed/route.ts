import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NewsItem } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Busca notícias de um único tópico usando Gemini + Google Search grounding
async function fetchTopicNews(topic: string): Promise<NewsItem[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} } as any],
  })

  const prompt = `Busque as 2 notícias mais recentes e relevantes sobre "${topic}" na web agora.

Para cada notícia encontrada, retorne um objeto JSON com:
- topic: "${topic}"
- title: título em português (traduza se necessário)
- summary: resumo de 2-3 frases em português, claro e informativo
- source: nome do veículo/site
- url: URL completa do artigo

Responda APENAS com um array JSON válido, sem markdown, sem texto extra. Exemplo:
[{"topic":"...","title":"...","summary":"...","source":"...","url":"..."}]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()

  // Extrai o array JSON mesmo se vier com texto ao redor
  const match = clean.match(/\[[\s\S]*\]/)
  if (!match) return []

  const items: NewsItem[] = JSON.parse(match[0])
  return items
}

export async function POST(req: NextRequest) {
  try {
    const { topics } = await req.json()

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: 'Nenhum tópico fornecido.' }, { status: 400 })
    }

    // Busca todos os tópicos em paralelo
    const results = await Promise.allSettled(
      topics.map((topic: string) => fetchTopicNews(topic))
    )

    const items: NewsItem[] = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : []
    )

    return NextResponse.json({ items })
  } catch (err: any) {
    console.error('Feed API error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
