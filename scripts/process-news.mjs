/**
 * Standalone Gemini processing script — runs directly with Node.js (no Next.js needed).
 * Used by GitHub Actions every 6 hours, after rss-ingest.mjs.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const GEMINI_KEY = process.env.GEMINI_API_KEY
const BATCH_SIZE = 40 // max sources per Gemini call
const LAZY_IMAGE_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif', 'favicon', '/favicon', 'apple-touch-icon', 'logo-icon']

function isLazyLoadImage(url) {
  if (!url) return false
  return LAZY_IMAGE_PATTERNS.some(p => url.toLowerCase().includes(p))
}

function normalizeText(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function textOverlapScore(a, b) {
  const aWords = new Set(normalizeText(a).split(' ').filter(w => w.length >= 3))
  const bWords = new Set(normalizeText(b).split(' ').filter(w => w.length >= 3))
  if (aWords.size === 0 || bWords.size === 0) return 0
  let overlap = 0
  for (const w of aWords) if (bWords.has(w)) overlap++
  return overlap / Math.max(1, Math.min(aWords.size, bWords.size))
}

function isGeneratedItemRelevant(item, results) {
  const genText = `${item.title || ''} ${item.summary || ''}`
  if (!genText.trim()) return false
  const idxs = (item.sourceIndexes || []).map(n => n - 1)
  const sourceText = idxs
    .filter(i => i >= 0 && i < results.length)
    .map(i => `${results[i].title || ''} ${results[i].content || ''}`)
    .join(' ')
  return textOverlapScore(genText, sourceText) >= 0.15
}

function getSourceHint(topic) {
  const t = topic.toLowerCase()
  if (/cinema|filme|série|entretenimento|music|album|award|oscar|emmy/.test(t)) return 'Variety, Deadline, Hollywood Reporter, Rolling Stone, Billboard'
  if (/política|governo|eleição|congress|senate|president/.test(t)) return 'Reuters, AP, CNN, BBC, The Guardian, NYT'
  if (/economia|mercado|finanças|stock|crypto|bitcoin/.test(t)) return 'Bloomberg, Financial Times, Reuters, WSJ'
  if (/tech|ia|inteligência artificial|startup|software/.test(t)) return 'TechCrunch, The Verge, Wired, Ars Technica'
  if (/esport|valorant|league|lol|overwatch|gaming|game|tft|teamfight/.test(t)) return 'Dot Esports, The Esports Observer, Liquipedia, HLTV'
  return 'Reuters, AP, BBC, The Guardian'
}

async function callGemini(topic, results, existingTitles) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const context = results.map((r, i) =>
    `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 600)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita estes eventos):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const sourceHint = getSourceHint(topic)

  const prompt = `Você é um Editor Sênior de um feed de notícias em tempo real no estilo exato do Perplexity Discover: textos curtos, impactantes, bem estruturados, com tom jornalístico empolgado mas factual.

**CONTEXTO ATUAL:**
- Data atual: ${today}
- Tópico principal: "${topic}"
- Conteúdo já publicado: ${existingContext}
- Fontes disponíveis: ${context}

**REGRAS RÍGIDAS:**
- Unicidade de Evento: Cada notícia deve cobrir **apenas UM evento principal** claro e independente. É permitido (e desejado) ter várias seções dentro da mesma notícia falando de aspectos diferentes do MESMO evento (ex: elenco + data de estreia + repercussão). O que é PROIBIDO é misturar eventos completamente diferentes (ex: não colocar notícia de Homem-Aranha junto com American Horror Story ou política no mesmo objeto JSON).
- Foque em anúncios oficiais, lançamentos, patches, revelações de elenco, trailers, resultados importantes, etc. Descarte guias, fóruns, wikis, apostas, quizzes e conteúdo irrelevante.
- Use nomes, números e termos técnicos **exatamente** como aparecem nas fontes (não parafraseie).
- Cruze informações de múltiplas fontes quando possível. Só inclua no sourceIndexes as fontes que realmente tratam do evento.
- **Prevenção de Duplicidade:** Se o evento já consta em \`${existingContext}\`, ignore-o. Se não houver fatos novos ou noticiáveis, retorne apenas \`[]\`.

**Tom e estilo:**
- Empolgado, mas neutro e profissional (estilo Discover).
- Use linguagem fluida.
- Inclua contagem de fontes de forma natural.
- Seja fiel ao conteúdo real das fontes, especialmente ao campo "body" completo quando disponível.

**PROCESSO DE EXECUÇÃO:**
1. **Triagem:** Analise as fontes e identifique eventos independentes.
2. **Verificação de Escopo:** Remova eventos que não sejam notícias reais ou que já foram cobertos.
3. **Redação:** Adote o tom editorial de \`${sourceHint}\` (neutro e jornalístico).
4. **Estruturação JSON:** Formate cada notícia individualmente.

**ESTRUTURA OBRIGATÓRIA (JSON):**
- \`title\`: Título direto em pt-BR com termos literais da fonte.
- \`summary\`: Parágrafo de 4-5 frases incorporando frases diretas das fontes.
- \`sections\`: 2 a 4 objetos com \`heading\` e \`body\`. **IMPORTANTE: Cada seção deve ter conteúdo substancial (3-5 linhas mínimo), não apenas um parágrafo curto.**
- \`conclusion\`: Seção "O que esperar" ou \`null\`.
- \`sourceIndexes\`: Array de inteiros referenciando apenas fontes pertinentes ao evento.

**INSTRUÇÕES DE PROFUNDIDADE:**
- Extraia informações COMPLETAS de cada fonte.
- Não resuma em uma frase; desenvolva a seção com detalhes, contexto e impacto.
- Use citações diretas das fontes quando apropriado.
- Cada seção deve antecipar perguntas que um leitor faria.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON. Se não houver conteúdo válido, retorne \`[]\`.

[{"title":"...","summary":"...","sections":[{"heading":"...","body":"Conteúdo substancial com múltiplas linhas de detalhes..."}],"conclusion":"...","sourceIndexes":[1,2]}]

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

async function processTopic(topic, rawItems, existingTitles) {
  const results = rawItems.map(item => ({
    url: item.url,
    title: item.title,
    content: item.content || '',
    image: item.image_url,
  }))

  const parsed = await callGemini(topic, results, existingTitles)
  const now = new Date().toISOString()
  const newsItems = []

  for (const item of parsed) {
    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) continue
    if (!isGeneratedItemRelevant(item, results)) continue

    const idxs = item.sourceIndexes.map(n => n - 1)

    // Find first valid image across all source indexes
    let imageUrl
    for (const idx of idxs) {
      const candidate = results[idx]?.image
      if (candidate && !isLazyLoadImage(candidate)) { imageUrl = candidate; break }
    }
    if (!imageUrl) continue

    const sources = idxs
      .filter(idx => idx >= 0 && idx < results.length)
      .map(idx => {
        const r = results[idx]
        return {
          name: new URL(r.url).hostname.replace('www.', ''),
          url: r.url,
          favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
        }
      })

    const conclusion = typeof item.conclusion === 'string'
      ? item.conclusion
      : item.conclusion?.body || undefined

    newsItems.push({
      id: randomUUID(),
      topic,
      title: item.title,
      summary: item.summary,
      sections: item.sections || [],
      conclusion,
      sources,
      image_url: imageUrl,
      published_at: now,
      cached_at: now,
    })
  }

  return newsItems
}

async function main() {
  // Get all distinct topics with unprocessed items
  const { data: topicRows, error: topicError } = await db
    .from('raw_items')
    .select('topic')
    .eq('processed', false)

  if (topicError) throw new Error('DB error: ' + topicError.message)
  if (!topicRows?.length) { console.log('No unprocessed items found.'); return }

  const topics = [...new Set(topicRows.map(r => r.topic).filter(Boolean))]
  console.log(`Topics to process: ${topics.join(', ')}`)

  let totalGenerated = 0
  let totalSaved = 0

  for (const topic of topics) {
    try {
      // Fetch unprocessed items for this topic
      const { data: rawItems } = await db
        .from('raw_items')
        .select('url, title, content, image_url, topic')
        .eq('topic', topic)
        .eq('processed', false)
        .order('pub_date', { ascending: false })
        .limit(BATCH_SIZE)

      if (!rawItems?.length) continue

      // Get existing titles to avoid duplicates
      const { data: existing } = await db
        .from('news_cache')
        .select('title')
        .eq('topic', topic)
        .order('published_at', { ascending: false })
        .limit(20)

      const existingTitles = (existing || []).map(r => r.title)

      console.log(`\n[${topic}] ${rawItems.length} items → Gemini...`)
      const newsItems = await processTopic(topic, rawItems, existingTitles)
      console.log(`[${topic}] Generated ${newsItems.length} articles`)

      if (newsItems.length > 0) {
        const { error: saveError } = await db.from('news_cache').upsert(
          newsItems,
          { onConflict: 'id' }
        )
        if (saveError) {
          console.error(`[${topic}] Save error:`, saveError.message)
        } else {
          totalSaved += newsItems.length
        }
      }

      // Mark all fetched items as processed
      await db.from('raw_items').update({ processed: true })
        .eq('topic', topic)
        .eq('processed', false)

      totalGenerated += newsItems.length
    } catch (err) {
      console.error(`[${topic}] Error:`, err.message)
    }
  }

  console.log(`\nDone! topics=${topics.length} generated=${totalGenerated} saved=${totalSaved}`)
}

main().catch(err => { console.error(err); process.exit(1) })
