/**
 * Lophos News Processing — Gemini 2.5 Flash-Lite Edition (Token-Optimized)
 *
 * Nova Arquitetura:
 * ✅ Modelo Eficiente: Gemini 2.5 Flash-Lite (menor taxa de tokens)
 * ✅ Processamento em Mini-Lotes: 3 fontes por vez (evita token limit)
 * ✅ Delay Estratégico: 20s entre tópicos para resetar quota de tokens/min
 * ✅ Proteção Free Tier: Chunks inteligentes evitam bloqueio do Google
 * ✅ Segurança de Dados: Transactional integrity contra perda de dados
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
  model: 'gemini-2.5-flash-lite'
})

const BATCH_SIZE = 3           // mini-batch per Gemini call (token optimization)
const CONTENT_CHARS = 2000     // reduced chars per source (token efficiency)
const DELAY_BETWEEN_TOPICS_MS = 20_000 // 20s between topics (token/min quota reset)
const DELAY_BETWEEN_CHUNKS_MS = 3_000  // 3s between mini-batch chunks (safety margin)
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
// GEMINI: Processamento em Mini-Lotes (Token-Optimized)
// ═══════════════════════════════════════════════════════════════
async function processTopicWithGemini(topic, results, existingTitles) {
  if (!results.length) return []

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const allParsedItems = []

  // Dividir em mini-lotes para evitar token limit
  for (let chunkIdx = 0; chunkIdx < results.length; chunkIdx += BATCH_SIZE) {
    const chunk = results.slice(chunkIdx, chunkIdx + BATCH_SIZE)
    const chunkNum = Math.floor(chunkIdx / BATCH_SIZE) + 1
    const totalChunks = Math.ceil(results.length / BATCH_SIZE)

    console.log(`[${topic}] Mini-lote ${chunkNum}/${totalChunks}: Processando ${chunk.length} fontes (token-optimized)...`)

    // Contexto otimizado: 2000 chars por fonte para evitar estourar limite
    const context = chunk.map((r, i) =>
      `[${chunkIdx + i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, CONTENT_CHARS)}`
    ).join('\n\n')

    const existingContext = existingTitles.length > 0
      ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
      : ''

    const prompt = `Você é o Curador-Chefe do Lophos. Sua missão: destilar ${chunk.length} fontes em artigos precisos e substanciais.

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
- Mini-lote ${chunkNum}/${totalChunks}: ${chunk.length} fontes disponíveis com até 2000 chars cada

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
        console.warn(`[${topic}] Mini-lote ${chunkNum}: Nenhuma resposta JSON válida`)
      } else {
        const parsed = JSON.parse(match[0])
        allParsedItems.push(...parsed)
        console.log(`[${topic}] Mini-lote ${chunkNum}: ${parsed.length} artigos gerados ✓`)
      }
    } catch (err) {
      // Gemini error (503, 429, etc) — NÃO marcar como processado
      const statusCode = err.status || err.message.match(/\d{3}/)
      console.error(`[${topic}] ⚠️  Erro na IA (mini-lote ${chunkNum}, ${statusCode}): ${err.message}. Mantendo items como não-processados para retry.`)
      throw err // Re-throw para que processTopic capture e retorne geminiError: true
    }

    // Delay inteligente entre chunks para respeitar token/min quota
    if (chunkIdx + BATCH_SIZE < results.length) {
      console.log(`[${topic}] Aguardando ${DELAY_BETWEEN_CHUNKS_MS / 1000}s antes do próximo mini-lote...\n`)
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS))
    }
  }

  return allParsedItems
}

async function processTopic(topic, rawItems, existingTitles) {
  const results = rawItems.map(item => ({
    url: item.url,
    title: item.title,
    content: item.content || '',
    image: item.image_url,
  }))

  if (!results.length) return { newsItems: [], success: true }

  // Processa tudo em lote único com Gemini
  let parsed
  try {
    parsed = await processTopicWithGemini(topic, results, existingTitles)
  } catch (err) {
    // Gemini error (503, 429, etc) — NÃO marcar como processado
    const statusCode = err.status || err.message.match(/\d{3}/)
    console.error(`[${topic}] ⚠️  Erro na IA (${statusCode}): ${err.message}. Mantendo items como não-processados para retry.`)
    return { newsItems: [], success: false, geminiError: true }
  }

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
      sourceIndexes: item.sourceIndexes, // ✅ Preserva índices para mapeamento de raw_items
    })
  }

  return { newsItems, success: true }
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
  console.log(`\n🦖 Lophos x Gemini 2.5 Flash-Lite (Token-Optimized)`)
  console.log(`Mini-batches: ${BATCH_SIZE} items | Delay: ${DELAY_BETWEEN_TOPICS_MS / 1000}s/topic`)
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
        .select('id, url, title, content, image_url, topic')
        .eq('topic', topic)
        .eq('processed', false)
        .order('pub_date', { ascending: false })
        .limit(BATCH_SIZE)

      if (!rawItems?.length) continue

      console.log(`[${topic}] ${rawItems.length} items → Gemini`)

      // Bloco Try/Catch Robusto: Se Gemini falhar, não marca como processado
      const { newsItems, success: geminiSuccess, geminiError } = await processTopic(
        topic,
        rawItems,
        allProcessedArticles.map(a => a.title)
      )

      // Se houve erro no Gemini (503, 429), pula este tópico e tenta no próximo batch
      if (geminiError) {
        if (ti < topics.length - 1) {
          console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_TOPICS_MS))
        }
        continue
      }

      const dedupedItems = []
      const successfullyProcessedRawIds = new Set()

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
              console.error(`[${topic}] ⚠️  Merge error: ${mergeError.message}. Item não será marcado como processado.`)
              // NÃO marca como processado se houver erro
            } else {
              match.sources = mergedSources
              match.keywords = mergedKeywords
              match.matched_topics = mergedMatchedTopics
              totalMerged++
              console.log(`  ✓ Merge em "${match.title}"`)
              // Marca os raw_items relacionados como processados
              if (Array.isArray(item.sourceIndexes)) {
                for (const rawId of item.sourceIndexes) {
                  const idx = rawId - 1
                  if (idx >= 0 && idx < rawItems.length) {
                    successfullyProcessedRawIds.add(rawItems[idx].id)
                  }
                }
              } else {
                console.warn(`[${topic}] ⚠️  sourceIndexes inválido no merge: ${typeof item.sourceIndexes}. Artigo salvo mas mapeamento skipped para revisão.`)
              }
            }
          } else {
            // Sem mudanças, mas merge bem-sucedido
            if (Array.isArray(item.sourceIndexes)) {
              for (const rawId of item.sourceIndexes) {
                const idx = rawId - 1
                if (idx >= 0 && idx < rawItems.length) {
                  successfullyProcessedRawIds.add(rawItems[idx].id)
                }
              }
            } else {
              console.warn(`[${topic}] ⚠️  sourceIndexes inválido (sem mudanças): ${typeof item.sourceIndexes}. Artigo salvo mas mapeamento skipped para revisão.`)
            }
          }
        } else {
          dedupedItems.push(item)
        }
      }

      // Salvar artigos deduplicados com confirmação de sucesso
      if (dedupedItems.length > 0) {
        const { error: saveError } = await db.from('articles').upsert(
          dedupedItems,
          { onConflict: 'id' }
        )
        if (saveError) {
          console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${dedupedItems.length} items não serão marcados como processados para retry.`)
          // NÃO marca como processado se houver erro de salvamento
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
            // Marca os raw_items relacionados como processados
            if (Array.isArray(item.sourceIndexes)) {
              for (const rawId of item.sourceIndexes) {
                const idx = rawId - 1
                if (idx >= 0 && idx < rawItems.length) {
                  successfullyProcessedRawIds.add(rawItems[idx].id)
                }
              }
            } else {
              console.warn(`[${topic}] ⚠️  sourceIndexes inválido no novo artigo: ${typeof item.sourceIndexes}. Artigo salvo mas mapeamento skipped para revisão.`)
            }
          }
          console.log(`  ✓ ${dedupedItems.length} artigos salvos`)
        }
      }

      totalGenerated += dedupedItems.length

      // ✅ Confirmação de Escrita: Só marque como processado os IDs que foram realmente salvos
      if (successfullyProcessedRawIds.size > 0) {
        try {
          const processedIds = Array.from(successfullyProcessedRawIds)
          const { error: updateError } = await db.from('raw_items')
            .update({ processed: true })
            .in('id', processedIds)

          if (updateError) {
            console.error(`[${topic}] ⚠️  Failed to mark items as processed: ${updateError.message}`)
          } else {
            console.log(`[${topic}] ✓ ${processedIds.length} items marcados como processados`)
          }
        } catch (err) {
          console.error(`[${topic}] ⚠️  Erro crítico ao marcar items como processados: ${err.message}. Items serão retidos para retry manual.`)
        }
      } else {
        console.warn(`[${topic}] ⚠️  Nenhum item marcado como processado (verifique sourceIndexes no JSON da IA)`)
      }

      // Delay para respeitar rate limit (15 req/min)
      if (ti < topics.length - 1) {
        console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_TOPICS_MS))
      }
    } catch (err) {
      console.error(`[${topic}] ⚠️  Erro crítico: ${err.message}. Items não serão marcados como processados.`)
    }
  }

  console.log(`\n✨ Done! topics=${topics.length} generated=${totalGenerated} saved=${totalSaved} merges=${totalMerged}`)
}

main().catch(err => { console.error(err); process.exit(1) })
