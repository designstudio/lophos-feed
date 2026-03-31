/**
 * Lophos News Processing — Gemini 2.0 Flash Edition
 *
 * Nova Arquitetura:
 * ✅ Contexto Brutal: 4000 chars por fonte (máximo de detalhes)
 * ✅ Processamento em Lote Único: Todas as 15 fontes de uma vez
 * ✅ Deduplicação Perfeita: Gemini com suporte a 1M tokens agrupa tudo
 * ✅ Código Limpo: Sem chunks complexos, fluxo direto
 * ✅ Rate Limit Friendly: 8s entre tópicos (15 req/min)
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash'
})

const BATCH_SIZE = 15          // max sources per Gemini call
const CONTENT_CHARS = 4000     // chars per source — BRUTAL CONTEXT
const DELAY_BETWEEN_TOPICS_MS = 8_000 // 8s between topics (15 req/min free tier)
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

// ═══════════════════════════════════════════════════════════════
// GEMINI: Processamento em Lote Único (Contexto Brutal)
// ═══════════════════════════════════════════════════════════════
async function processTopicWithGemini(topic, results, existingTitles) {
  if (!results.length) return []

  console.log(`[${topic}] Gemini: Processando ${results.length} fontes em lote único...`)

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Contexto brutal: 4000 chars por fonte
  const context = results.map((r, i) =>
    `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, CONTENT_CHARS)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const prompt = `Você é o Curador-Chefe do Lophos. Sua missão: destilar ${results.length} fontes em artigos precisos e substanciais.

**INSTRUÇÕES CRÍTICAS:**

1. **Agrupamento de Eventos**: Identifique qual URL fala do MESMO evento real. Se 3 URLs cobrem o lançamento do PS5, agrupe como UM evento.

2. **Fidelidade Brutal**:
   - Se menciona "dano aumentou 15%", comente com "15%"
   - Se menciona "CEO João Silva", cite "João Silva"
   - Se menciona "preço caiu de R$100 para R$80", reproduza os valores
   - SEM GENÉRICOS: Nada de "fãs estão felizes" sem detalhes

3. **Extração de Dados**:
   - Números: datas, porcentagens, valores, placares, estatísticas
   - Mudanças Técnicas: patch notes, features, atualizações
   - Citações: reproduza ou parafraseie fielmente (não resuma)
   - Nomes: use nomes reais de pessoas, empresas, produtos

4. **Tom Direto**: Comece pelo fato mais impactante. Sem "Em um mundo onde..." ou "O futuro promete".

5. **Estrutura JSON Obrigatória**:
   - Cada artigo = UM evento
   - title: Direto em pt-BR, termos da fonte
   - summary: 2-4 frases densas COM DADOS (números, mudanças, citações)
   - sections: 1-3 seções (não invente para preencher)
   - sourceIndexes: [1,2,5] apenas as fontes que cobrem ESTE evento
   - keywords: 5-15 termos em minúsculas

6. **Diferenciação de Conteúdo**:
   - Hard news (fatos, dados, eventos reais): artigo factual isolado
   - Opinião/Análise/Retrospectiva: seção separada OU artigo distinto
   - NUNCA misture análise histórica de uma marca com bilheteria de outro filme
   - SOMENTE mescle conteúdos diferentes se forem do MESMO evento factual
   - Se houver dúvida, errar para o lado de gerar artigos separados

**CONTEXTO:**
- Data: ${today}
- Tópico: "${topic}"
- Artigos já publicados: ${existingContext}
- ${results.length} fontes disponíveis com até 4000 chars cada

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Sem markdown, comentários ou texto extra.

Se não houver conteúdo válido, retorne: []

[
  {
    "title": "PS5 Pro Lançado com Upgrade de GPU",
    "summary": "Sony anuncia PS5 Pro com GPU 45% mais rápida (vs PS5 base). Preço: $799 (lançamento em novembro). Especialistas apontam melhora em ray-tracing e resolução.",
    "sections": [
      {
        "heading": "Especificações Técnicas",
        "body": "A GPU aumenta de 10.28 TFLOPS (PS5 original) para 16.7 TFLOPS. CPU mantém os mesmos 3.5GHz. 16GB de GDDR6 total (10 padrão + 6 para I/O)."
      },
      {
        "heading": "Preço e Disponibilidade",
        "body": "Custa $799 USD, $200 a mais que a versão original. Disponível a partir de novembro de 2024. Não inclui disco Blu-ray — acoplador opcional custa $80."
      }
    ],
    "sourceIndexes": [1, 3, 5],
    "keywords": ["ps5", "playstation", "gpu", "sony", "console", "gaming", "hardware", "upgrade", "2024"]
  }
]

FONTES:
${context}`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Extrai JSON da resposta
    const match = text.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn(`[${topic}] Gemini: Nenhuma resposta JSON válida`)
      return []
    }

    return JSON.parse(match[0])
  } catch (err) {
    console.error(`[${topic}] Gemini error:`, err.message)
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

  if (!results.length) return []

  // Processa tudo em lote único com Gemini
  const parsed = await processTopicWithGemini(topic, results, existingTitles)
  const now = new Date().toISOString()
  const newsItems = []

  for (const item of parsed) {
    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) continue
    if (!isGeneratedItemRelevant(item, results)) continue

    const idxs = item.sourceIndexes.map(n => n - 1)

    // Find first valid image
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

    const keywords = Array.isArray(item.keywords)
      ? [...new Set([topic, ...item.keywords.map(k => String(k).toLowerCase().trim())])]
      : [topic]

    newsItems.push({
      id: randomUUID(),
      topic,
      title: item.title,
      summary: item.summary,
      sections: item.sections || [],
      sources,
      image_url: imageUrl,
      published_at: now,
      cached_at: now,
      matched_topics: keywords,
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
  console.log(`\n🦖 Lophos x Gemini 2.0 Flash`)
  console.log(`Topics to process: ${topics.join(', ')}\n`)

  // Fetch existing articles (últimas 24h)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: globalExisting } = await db
    .from('articles')
    .select('id, title, sources, keywords, matched_topics')
    .gte('published_at', since24h)
    .order('published_at', { ascending: false })
    .limit(100)

  const allProcessedArticles = (globalExisting || []).map(r => ({
    id: r.id,
    title: r.title,
    sources: r.sources || [],
    keywords: r.keywords || [],
    matched_topics: r.matched_topics || [],
  }))
  console.log(`Artigos existentes (últimas 24h): ${allProcessedArticles.length}\n`)

  const SIMILARITY_THRESHOLD = 0.85
  let totalGenerated = 0
  let totalMerged = 0
  let totalSaved = 0

  for (let ti = 0; ti < topics.length; ti++) {
    const topic = topics[ti]
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

      console.log(`[${topic}] ${rawItems.length} items → Gemini`)
      const newsItems = await processTopic(topic, rawItems, allProcessedArticles.map(a => a.title))

      const dedupedItems = []

      for (const item of newsItems) {
        const match = allProcessedArticles.find(
          existing => textOverlapScore(item.title, existing.title) >= SIMILARITY_THRESHOLD
        )

        if (match) {
          const existingUrls = new Set((match.sources || []).map(s => s.url))
          const newSources = item.sources.filter(s => !existingUrls.has(s.url))
          const mergedKeywords = [...new Set([...match.keywords, ...(item.keywords || [])])]
          const mergedMatchedTopics = [...new Set([...match.matched_topics, ...(item.matched_topics || [])])]

          const keywordsChanged = mergedKeywords.length > match.keywords.length
          const topicsChanged = mergedMatchedTopics.length > match.matched_topics.length

          if (newSources.length > 0 || keywordsChanged || topicsChanged) {
            const mergedSources = [...match.sources, ...newSources]
            const { error: mergeError } = await db
              .from('articles')
              .update({
                sources: mergedSources,
                keywords: mergedKeywords,
                matched_topics: mergedMatchedTopics,
              })
              .eq('id', match.id)

            if (mergeError) {
              console.error(`[${topic}] Merge error:`, mergeError.message)
            } else {
              match.sources = mergedSources
              match.keywords = mergedKeywords
              match.matched_topics = mergedMatchedTopics
              totalMerged++
              console.log(`  ✓ Merge em "${match.title}"`)
            }
          }
        } else {
          dedupedItems.push(item)
        }
      }

      if (dedupedItems.length > 0) {
        const { error: saveError } = await db.from('articles').upsert(
          dedupedItems,
          { onConflict: 'id' }
        )
        if (saveError) {
          console.error(`[${topic}] Save error:`, saveError.message)
        } else {
          totalSaved += dedupedItems.length
          for (const item of dedupedItems) {
            allProcessedArticles.push({
              id: item.id,
              title: item.title,
              sources: item.sources,
              keywords: item.keywords || [],
              matched_topics: item.matched_topics || [],
            })
          }
          console.log(`  ✓ ${dedupedItems.length} artigos salvos`)
        }
      }

      totalGenerated += dedupedItems.length

      // Mark items as processed
      await db.from('raw_items').update({ processed: true })
        .eq('topic', topic)
        .eq('processed', false)

      // Delay para respeitar rate limit (15 req/min)
      if (ti < topics.length - 1) {
        console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_TOPICS_MS))
      }
    } catch (err) {
      console.error(`[${topic}] Error:`, err.message)
    }
  }

  console.log(`\n✨ Done! topics=${topics.length} generated=${totalGenerated} saved=${totalSaved} merges=${totalMerged}`)
}

main().catch(err => { console.error(err); process.exit(1) })
