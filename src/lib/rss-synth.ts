import { getSupabaseAdmin } from '@/lib/supabase'
import { NewsItem } from '@/lib/types'

const GEMINI_KEY = process.env.GEMINI_API_KEY!

// ─── Generate embedding for a topic query ─────────────────────
async function generateQueryEmbedding(topic: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: topic }] },
          taskType: 'RETRIEVAL_QUERY',
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.embedding?.values ?? null
  } catch {
    return null
  }
}

// ─── Gemini synthesis ─────────────────────────────────────────
async function synthesizeWithGemini(topic: string, items: any[], existingTitles: string[]): Promise<any[]> {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const context = items.map((r, i) =>
    `[${i + 1}] ${r.source_name} — "${r.title}"\n${(r.summary || r.content || '').slice(0, 600)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
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
6. Tom: neutro, jornalístico, sem clickbait. Escreva em pt-BR.

ESTRUTURA:
[{"title":"...","summary":"...","sections":[{"heading":"...","body":"..."}],"conclusion":"...","sourceIndexes":[1,2]}]

Responda APENAS com JSON válido.

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

// ─── Main export ──────────────────────────────────────────────
export async function synthesizeTopicFromRSS(
  topic: string,
  existingTitles: string[]
): Promise<NewsItem[]> {
  const db = getSupabaseAdmin()
  const now = new Date().toISOString()

  // 1. Generate embedding for the topic
  const queryEmbedding = await generateQueryEmbedding(topic)

  let items: any[] = []

  if (queryEmbedding) {
    // 2a. Semantic search via pgvector
    const { data, error } = await db.rpc('match_raw_items', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: 0.45,
      match_count: 8,
      only_unprocessed: true,
    })
    if (!error && data?.length) {
      items = data
      console.log(`[rss-synth] semantic search for "${topic}": ${items.length} items (top similarity: ${items[0]?.similarity?.toFixed(3)})`)
    }
  }

  // 2b. Fallback: keyword search if no embedding results
  if (items.length === 0) {
    console.log(`[rss-synth] no embedding results for "${topic}", trying keyword fallback`)
    const { data } = await db
      .from('raw_items')
      .select('id, topic, title, url, image_url, summary, content, source_name, pub_date')
      .eq('processed', false)
      .gte('pub_date', new Date(Date.now() - 72 * 3600 * 1000).toISOString())
      .ilike('title', `%${topic.split(' ')[0]}%`)
      .order('pub_date', { ascending: false })
      .limit(8)
    items = data || []
  }

  if (items.length === 0) return []

  // 3. Synthesize with Gemini
  const synthesized = await synthesizeWithGemini(topic, items, existingTitles)
  if (!synthesized.length) return []

  // 4. Build rows
  const rows = synthesized.map((item: any) => {
    const idxs: number[] = (item.sourceIndexes || []).map((n: number) => n - 1)
    const sources = idxs
      .filter(i => i >= 0 && i < items.length)
      .map(i => ({
        name: items[i].source_name,
        url: items[i].url,
        favicon: `https://www.google.com/s2/favicons?domain=${items[i].url}&sz=32`,
      }))

    const primaryItem = items[idxs[0]] ?? items[0]

    return {
      id: crypto.randomUUID(),
      topic,
      title: item.title,
      summary: item.summary,
      sections: item.sections || [],
      conclusion: typeof item.conclusion === 'string' ? item.conclusion : null,
      sources,
      image_url: primaryItem?.image_url || null,
      published_at: now,
      cached_at: now,
    }
  })

  // 5. Insert into news_cache
  const { error } = await db.from('news_cache').insert(rows)
  if (error) { console.error(`[rss-synth] insert error "${topic}":`, error.message); return [] }

  // 6. Mark used raw_items as processed
  await db.from('raw_items').update({ processed: true }).in('id', items.map(i => i.id))

  console.log(`[rss-synth] synthesized ${rows.length} articles for "${topic}"`)

  return rows.map((row: any) => ({
    id: row.id, topic: row.topic, title: row.title, summary: row.summary,
    sections: row.sections, conclusion: row.conclusion || undefined,
    sources: row.sources, imageUrl: row.image_url,
    publishedAt: row.published_at, cachedAt: row.cached_at,
  }))
}
