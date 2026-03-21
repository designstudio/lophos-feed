import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GEMINI_KEY = process.env.GEMINI_API_KEY!

// ─── Similarity: score how relevant a raw_item is for a topic ─
function relevanceScore(item: any, topic: string): number {
  const needle = topic.toLowerCase()
  const title = (item.title || '').toLowerCase()
  const summary = (item.summary || '').toLowerCase()
  const content = (item.content || '').toLowerCase()

  // Tokenize topic into keywords (handles "League of Legends", "TFT" etc)
  const keywords = needle
    .split(/\s+/)
    .filter(w => w.length > 2)
    .concat([needle]) // also match the full phrase

  let score = 0
  for (const kw of keywords) {
    if (title.includes(kw))   score += 10  // title match is strongest
    if (summary.includes(kw)) score += 4
    if (content.includes(kw)) score += 1
  }

  // Boost for recency (items from last 24h get +3)
  if (item.pub_date) {
    const age = Date.now() - new Date(item.pub_date).getTime()
    if (age < 86400000) score += 3       // < 24h
    else if (age < 259200000) score += 1 // < 72h
  }

  return score
}

// ─── Gemini synthesis (same logic as news.ts) ─────────────────
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
6. Se todos os eventos já foram cobertos, retorne [].
7. Tom: neutro, jornalístico, sem clickbait. Escreva em pt-BR.

ESTRUTURA de cada notícia:
- title: título preciso em pt-BR
- summary: parágrafo introdutório de 4-5 frases
- sections: array de 2-4 seções com heading e body
- conclusion: "O que esperar" ou null
- sourceIndexes: índices das fontes usadas [1,2,3...]

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

// ─── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()
  const body = await req.json().catch(() => ({}))

  // Get topics — from request or from user's saved topics
  let topics: string[] = body.topics ?? []
  if (topics.length === 0) {
    const { data } = await db
      .from('user_topics')
      .select('topic')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    topics = (data ?? []).map((r: any) => r.topic)
  }

  if (topics.length === 0) {
    return NextResponse.json({ error: 'No topics' }, { status: 400 })
  }

  const forceRefresh: boolean = body.forceRefresh ?? false
  const now = new Date().toISOString()
  const results: any[] = []

  // Load unprocessed raw_items from last 72h
  const { data: rawItems } = await db
    .from('raw_items')
    .select('id, topic, title, url, image_url, summary, content, source_name, pub_date')
    .eq('processed', false)
    .gte('pub_date', new Date(Date.now() - 72 * 3600 * 1000).toISOString())
    .order('pub_date', { ascending: false })
    .limit(500)

  if (!rawItems?.length) {
    return NextResponse.json({ items: [], message: 'No unprocessed items' })
  }

  for (const topic of topics) {
    try {
      // Check if we already have a recent synthesis for this topic
      if (!forceRefresh) {
        const { data: fetchRow } = await db
          .from('topic_fetches')
          .select('last_fetched')
          .eq('topic', topic)
          .single()

        if (fetchRow?.last_fetched) {
          const age = Date.now() - new Date(fetchRow.last_fetched).getTime()
          if (age < 2 * 3600 * 1000) continue // skip if synthesized < 2h ago
        }
      }

      // Score and rank raw_items for this topic
      const scored = rawItems
        .map(item => ({ item, score: relevanceScore(item, topic) }))
        .filter(({ score }) => score >= 5) // minimum relevance threshold
        .sort((a, b) => b.score - a.score)
        .slice(0, 8) // top 8 most relevant
        .map(({ item }) => item)

      if (scored.length === 0) continue

      // Get existing titles to avoid duplicates
      const { data: existing } = await db
        .from('news_cache')
        .select('title')
        .eq('topic', topic)
        .order('cached_at', { ascending: false })
        .limit(20)
      const existingTitles = (existing || []).map((r: any) => r.title)

      // Synthesize with Gemini
      const synthesized = await synthesizeWithGemini(topic, scored, existingTitles)
      if (!synthesized.length) continue

      // Build news_cache rows
      const rows = synthesized.map((item: any) => {
        const idxs: number[] = (item.sourceIndexes || []).map((n: number) => n - 1)
        const sources = idxs
          .filter(i => i >= 0 && i < scored.length)
          .map(i => ({
            name: scored[i].source_name,
            url: scored[i].url,
            favicon: `https://www.google.com/s2/favicons?domain=${scored[i].url}&sz=32`,
          }))

        // Image from primary source (RSS already has it)
        const primaryItem = scored[idxs[0]] ?? scored[0]
        const imageUrl = primaryItem?.image_url || null

        const safeId = `${topic}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80)

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
      const { error: insertErr } = await db.from('news_cache').insert(rows)
      if (insertErr) {
        console.error(`[synthesize] insert error for "${topic}":`, insertErr.message)
        continue
      }

      // Mark raw_items as processed
      const usedIds = scored.map(i => i.id)
      await db.from('raw_items').update({ processed: true }).in('id', usedIds)

      // Update topic_fetches
      await db.from('topic_fetches').upsert(
        { topic, last_fetched: now, updated_at: now },
        { onConflict: 'topic' }
      )

      results.push(...rows)
    } catch (e) {
      console.error(`[synthesize] error for "${topic}":`, e)
    }
  }

  return NextResponse.json({ items: results, synthesized: results.length })
}
