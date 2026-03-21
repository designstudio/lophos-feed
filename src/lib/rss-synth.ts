import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

const GEMINI_KEY = process.env.GEMINI_API_KEY!

function relevanceScore(item: any, topic: string): number {
  const needle = topic.toLowerCase()
  const title = (item.title || '').toLowerCase()
  const summary = (item.summary || '').toLowerCase()
  const content = (item.content || '').toLowerCase()

  // Expand keywords: "league of legends" → ["league", "legends", "lol", "league of legends"]
  // "american horror story" → ["american", "horror", "story", "ahs", ...]
  const words = needle.split(/\s+/).filter((w: string) => w.length > 2)
  const keywords = [...words, needle]
  // Add common abbreviations
  const abbrevMap: Record<string, string[]> = {
    'league of legends': ['lol', 'league'],
    'teamfight tactics': ['tft'],
    'american horror story': ['ahs'],
    'monarch legacy of monsters': ['monarch'],
    'valorant': ['vct', 'valorant'],
    'overwatch': ['owl', 'overwatch'],
  }
  const extra = abbrevMap[needle] || []
  keywords.push(...extra)

  let score = 0
  for (const kw of keywords) {
    if (title.includes(kw))   score += 10
    if (summary.includes(kw)) score += 4
    if (content.includes(kw)) score += 1
  }

  if (item.pub_date) {
    const age = Date.now() - new Date(item.pub_date).getTime()
    if (age < 86400000)   score += 3
    else if (age < 259200000) score += 1
  }

  return score
}

async function synthesizeWithGemini(
  topic: string,
  items: any[],
  existingTitles: string[]
): Promise<any[]> {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const context = items.map((r, i) =>
    `[${i + 1}] ${r.source_name} — "${r.title}"\n${(r.summary || r.content || '').slice(0, 600)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map((t: string) => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Você é um editor sênior de um feed de notícias estilo Perplexity Discover.

Hoje é ${today}. Tópico: "${topic}".
${existingContext}
REGRAS:
1. Use APENAS as fontes fornecidas. NÃO invente fatos.
2. Agrupe fontes do MESMO evento em 1 notícia. Máx 2 notícias se eventos genuinamente distintos.
3. IGNORE resultados irrelevantes ao tópico.
4. Só crie notícias sobre eventos noticiáveis reais.
5. Se não houver evento noticiável, retorne [].
6. Se todos os eventos já foram cobertos, retorne [].
7. Tom: neutro, jornalístico, sem clickbait. Escreva em pt-BR.

ESTRUTURA:
- title, summary (4-5 frases), sections (2-4 com heading+body), conclusion, sourceIndexes

Responda APENAS com JSON válido:
[{"title":"...","summary":"...","sections":[{"heading":"...","body":"..."}],"conclusion":"...","sourceIndexes":[1,2]}]

FONTES:
${context}`

  const res = await fetch(
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
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) return []
  return JSON.parse(match[0])
}

export async function synthesizeTopicFromRSS(
  topic: string,
  existingTitles: string[],
  rawItems: any[]
): Promise<NewsItem[]> {
  const db = getSupabaseAdmin()
  const now = new Date().toISOString()

  // Score and rank raw_items for this topic
  const scored = rawItems
    .map(item => ({ item, score: relevanceScore(item, topic) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ item }) => item)

  if (scored.length === 0) return []

  const synthesized = await synthesizeWithGemini(topic, scored, existingTitles)
  if (!synthesized.length) return []

  const rows = synthesized.map((item: any) => {
    const idxs: number[] = (item.sourceIndexes || []).map((n: number) => n - 1)
    const sources = idxs
      .filter((i: number) => i >= 0 && i < scored.length)
      .map((i: number) => ({
        name: scored[i].source_name,
        url: scored[i].url,
        favicon: `https://www.google.com/s2/favicons?domain=${scored[i].url}&sz=32`,
      }))

    const primaryItem = scored[idxs[0]] ?? scored[0]
    const imageUrl = primaryItem?.image_url || null

    const safeId = crypto.randomUUID()

    return {
      id: safeId,
      topic,
      title: item.title,
      summary: item.summary,
      sections: item.sections || [],
      conclusion: typeof item.conclusion === 'string' ? item.conclusion : null,
      sources,
      image_url: imageUrl,
      published_at: now,
      cached_at: now,
    }
  })

  // Insert into news_cache
  const { error } = await db.from('news_cache').insert(rows)
  if (error) { console.error(`[rss-synth] insert error "${topic}":`, error.message); return [] }

  // Mark raw_items as processed
  await db.from('raw_items').update({ processed: true }).in('id', scored.map((i: any) => i.id))

  return rows.map((row: any) => ({
    id: row.id, topic: row.topic, title: row.title, summary: row.summary,
    sections: row.sections || [], conclusion: row.conclusion || undefined,
    sources: row.sources, imageUrl: row.image_url,
    publishedAt: row.published_at, cachedAt: row.cached_at,
  }))
}
