/**
 * One-time script to backfill matched_topics with rich keywords for
 * existing articles articles that only have the basic topic tag.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const GEMINI_KEY = process.env.GEMINI_API_KEY
const BATCH_SIZE = 20 // articles per Gemini call

async function generateKeywords(articles) {
  const context = articles.map((a, i) =>
    `[${i + 1}] topic: ${a.topic}\ntitle: ${a.title}\nsummary: ${a.summary || ''}`
  ).join('\n\n')

  const prompt = `Para cada artigo abaixo, gere um array de 5 a 15 palavras-chave em letras minúsculas para matching e descoberta.

Inclua obrigatoriamente:
- O tópico geral do artigo (ex: "games", "música")
- Entidades específicas: nomes de jogos, filmes, séries, pessoas, eventos, times, bandas
- Termos que um usuário poderia cadastrar pra receber esse artigo (ex: "valorant", "vct 2026", "taylor swift", "horror", "slasher")
- Variações em pt-BR e inglês quando relevante

Retorne EXCLUSIVAMENTE um array JSON onde cada item tem "id" e "keywords":
[{"id":"...","keywords":["term1","term2","term3"]}]

ARTIGOS:
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

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    return JSON.parse(match[0])
  } catch {
    return []
  }
}

async function main() {
  // Fetch articles with simple matched_topics (only 1 item = just the topic)
  const { data: articles, error } = await db
    .from('articles')
    .select('id, topic, title, summary, matched_topics')
    .order('published_at', { ascending: false })

  if (error) throw new Error('DB error: ' + error.message)
  if (!articles?.length) { console.log('No articles found.'); return }

  // Filter only those with simple/empty matched_topics
  const toBackfill = articles.filter(a =>
    !a.matched_topics || a.matched_topics.length <= 1
  )

  console.log(`Total articles: ${articles.length}`)
  console.log(`Need backfill: ${toBackfill.length}`)

  let updated = 0
  let errors = 0

  for (let i = 0; i < toBackfill.length; i += BATCH_SIZE) {
    const batch = toBackfill.slice(i, i + BATCH_SIZE)
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toBackfill.length / BATCH_SIZE)} (${batch.length} articles)...`)

    try {
      const results = await generateKeywords(batch)

      // Match results back by position (Gemini returns in order)
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j]
        const result = results[j]
        const keywords = result?.keywords

        if (!Array.isArray(keywords) || keywords.length === 0) continue

        const matched_topics = [...new Set([article.topic, ...keywords.map(k => String(k).toLowerCase().trim())])]

        const { error: updateError } = await db
          .from('articles')
          .update({ matched_topics })
          .eq('id', article.id)

        if (updateError) {
          console.error(`  ❌ ${article.title?.slice(0, 50)}: ${updateError.message}`)
          errors++
        } else {
          console.log(`  ✅ ${article.title?.slice(0, 60)}`)
          console.log(`     → ${matched_topics.join(', ')}`)
          updated++
        }
      }
    } catch (err) {
      console.error(`Batch error: ${err.message}`)
      errors++
    }
  }

  console.log(`\nDone! updated=${updated} errors=${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
