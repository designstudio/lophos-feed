/**
 * 🎬 HORROR TEST SUITE — Teste Isolado de Clustering Rígido
 *
 * ⚡ Modo Teste Controlado:
 * ✅ Processa APENAS topic="horror" (isolado)
 * ✅ BATCH_SIZE=10 (controle fino)
 * ✅ Verbose logging em cada etapa
 * ✅ Valida clustering rígido (80% similarity)
 * ✅ Detecta mishmashes em tempo real
 *
 * Objetivo: Validar que "Dread Central" + "Nightmare Magazine"
 * agrupam corretamente, mas horror ≠ sci-fi
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// PAID TIER: Gemini 2.5 Flash-Lite para TUDO (ilimitado, mais barato)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite'
})

// 🧪 TEST MODE CONFIGURATION
const BATCH_SIZE = 10           // TESTE: Apenas 10 items por rodada (controle fino)
const CONTENT_CHARS = 2000      // chars per source
const DELAY_BETWEEN_TOPICS_MS = 500 // 500ms entre tópicos (mais observável)
const DELAY_BETWEEN_CLUSTERS_MS = 0 // Sem delay entre clusters
const TEST_TOPIC = 'horror'     // 🎬 FILTRO: Processa APENAS horror
const DRY_RUN = false           // ⚠️  Set true para simular sem salvar (use: DRY_RUN=true node scripts/process-horror.mjs)
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
  return textOverlapScore(genText, sourceText) >= 0.01  // DERRUBE OS MUROS: threshold mínimo (0.01) — Conteúdo Premium não pode ser censurado
}

// ═══════════════════════════════════════════════════════════════
// FASE 1: Agrupamento Inteligente (Clustering Inquebrável)
// ═══════════════════════════════════════════════════════════════
async function clusterRawItems(topic, items) {
  if (items.length <= 1) {
    // Só 1 item = 1 cluster com seu ID real
    return [[items[0].id]]
  }

  // Criar lista com índices 1-based (para o prompt) e títulos
  const titlesContext = items.map((item, i) =>
    `${i + 1}. ${item.title}`
  ).join('\n')

  const clusterPrompt = `VOCÊ DEVE RETORNAR APENAS UM ARRAY JSON PURO. NADA MAIS. NEM MARKDOWN, NEM COMENTÁRIOS, NEM EXPLICAÇÕES.

🚨 CLUSTERING RÍGIDO (QUALIDADE MÁXIMA):
Agrupe APENAS notícias que tratam do EXATO mesmo assunto/evento/franquia.

REGRAS ANTI-MISTURA:
1. **Nomes Próprios Idênticos**: "Super Mario" vs "Cape Fear" = NUNCA agrupar (franquias diferentes!)
2. **80% Similaridade Semântica**: Se títulos não compartilham contexto claro (jogo, filme, empresa), NÃO agrupe
3. **Na Dúvida, NÃO Agrupe**: Super Mario 6 e Mario Kart = OK (mesma franquia). Mario e Cape Fear = NUNCA.
4. **Um item = um cluster**: Se isolado, volta sozinho. Não force agrupamento.

EXEMPLO ERRADO ❌: [[1,2,3]] onde 1=Super Mario, 2=Cape Fear, 3=Fall 2
EXEMPLO CORRETO ✅: [[1], [2], [3]] (cada um isolado)

FORMATO OBRIGATÓRIO: [[1,3,5], [2,4], [6,7,8]]

TÍTULOS:
${titlesContext}

RESPONDA APENAS COM O JSON, NADA MAIS:
`

  try {
    const result = await model.generateContent(clusterPrompt)
    const response = result.response
    const text = response.text().trim()

    // PARSER INQUEBRÁVEL: Extrai tudo entre [ e ] mais externo
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')

    if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
      console.warn(`[${topic}] ⚠️  Clustering falhou (JSON inválido), usando fallback`)
      return items.map(item => [item.id])
    }

    const jsonStr = text.substring(firstBracket, lastBracket + 1)
    let clusters

    try {
      clusters = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.warn(`[${topic}] ⚠️  Parse JSON falhou: ${parseErr.message}. Fallback ativado.`)
      return items.map(item => [item.id])
    }

    // Validar estrutura: deve ser array of arrays
    if (!Array.isArray(clusters)) {
      console.warn(`[${topic}] ⚠️  Clusters não é array, fallback`)
      return items.map(item => [item.id])
    }

    // Converter índices 1-based para IDs reais
    const mappedClusters = clusters
      .filter(cluster => Array.isArray(cluster) && cluster.length > 0)
      .map(cluster =>
        cluster
          .filter(idx => typeof idx === 'number' && idx >= 1 && idx <= items.length)
          .map(idx => items[idx - 1].id)
      )
      .filter(cluster => cluster.length > 0)

    if (mappedClusters.length === 0) {
      console.warn(`[${topic}] ⚠️  Nenhum cluster válido, fallback`)
      return items.map(item => [item.id])
    }

    console.log(`[${topic}] ✓ Clustering: ${items.length} itens → ${mappedClusters.length} clusters`)
    return mappedClusters
  } catch (err) {
    console.error(`[${topic}] ⚠️  Erro no clustering: ${err.message}. Usando fallback.`)
    return items.map((_, i) => [i])
  }
}

// ═══════════════════════════════════════════════════════════════
// FASE 2: Processamento de Conteúdo (Geração de Artigos)
// ═══════════════════════════════════════════════════════════════
async function processTopicWithGemini(topic, results, existingTitles, clusters, rawItemsMap) {
  if (!results.length || !clusters.length) return []

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const allParsedItems = [] // Array de { item, clusterSourceIds }
  const allProcessedClusterSourceIds = new Set() // Rastreia TODOS os clusters processados com sucesso

  // Processar cada cluster (contém source_ids reais, não índices)
  for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
    const clusterSourceIds = clusters[clusterIdx]  // IDs reais dos raw_items
    const clusterNum = clusterIdx + 1

    // Mapear IDs para resultados (para obter conteúdo)
    const clusterItems = clusterSourceIds
      .map(sourceId => {
        const rawItem = rawItemsMap.get(sourceId)
        return rawItem ? results.find(r => r.url === rawItem.url) : null
      })
      .filter(Boolean)

    console.log(`[${topic}] Cluster ${clusterNum}/${clusters.length}: Processando ${clusterItems.length} fontes relacionadas (source_ids: ${clusterSourceIds.join(',')})...`)

    // Contexto com os itens do cluster (para geração do artigo)
    const context = clusterItems.map((r, i) =>
      `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, CONTENT_CHARS)}`
    ).join('\n\n')

    const existingContext = existingTitles.length > 0
      ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
      : ''

    const prompt = `Você é o Curador-Chefe do Lophos, o portal de notícias líder em 2026.
Sua missão: transformar um cluster de fontes relacionadas no artigo mais denso, factual e relevante possível.

**1. REGRAS ANTI-ALUCINAÇÃO (PRIORIDADE MÁXIMA):**
- Utilize apenas informações explícitas nas fontes fornecidas.
- Proibido inferir, assumir ou completar dados ("é provável que", "fãs sugerem").
- Se um dado não estiver claramente escrito nas fontes, não inclua.
- Números, datas, nomes e especificações devem ser literais. Se a fonte diz "aumento significativo", NÃO transforme em "15%".
- Tom seco, direto e jornalístico. Sem introduções poéticas ou floreios.

🚨 **REJEIÇÃO INTERNA (CLUSTERING CORRETO):**
- **Se o cluster contiver assuntos claramente distintos**, ignore e retorne [].
- Exemplo ERRADO: 1 fonte sobre "Super Mario 6", 1 sobre "Cape Fear", 1 sobre "Fall 2" → RETORNAR []
- Exemplo CORRETO: 3 fontes sobre "Nintendo Switch 2 lançamento" → 1 artigo unificado
- **Na dúvida sobre coesão do cluster: RETORNE []**. Qualidade > volume.

**2. CRITÉRIOS DE NOTICIABILIDADE (FILTRO DE QUALIDADE):**
- **GERAR ARTIGO:** Lançamentos de produtos/hardware (Galaxy S26, PS5, Switch 2), trailers, anúncios de filmes/séries, atualizações de games (patch notes), mudanças de preços de mercado (gasolina, dólar, ações), contratações relevantes e colaborações (ex: Ed Sheeran x Pokémon).
- **IGNORAR (Retornar []):** Listas puras de cupons, ofertas de "madrugada" sem fato novo, anúncios genéricos de "compre agora" ou promoções de varejo sem contexto de lançamento.
- **NA DÚVIDA:** Gere o artigo. O Lophos prefere informar ao silenciar.

**INSTRUÇÕES DE PROCESSAMENTO:**
- Agrupamento: Una fontes que tratem exatamente do mesmo evento factual.
- Fidelidade Brutal: Todo número, nome, valor ou mudança deve vir diretamente das fontes.
- Citações: reproduza ou parafraseie fielmente (nunca resuma demais)
- Proibido: "fãs estão animados", "diversos itens", "muitos usuários"

**Tom:**
Direto, jornalístico, sem floreios. Comece pelo fato mais impactante.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON com UM artigo (ou [] se vazio). Sem markdown, comentários ou texto extra.

[
  {
    "title": "manchete forte, clara, com termos da fonte",
    "summary": "2-4 frases carregadas de dados",
    "sections": [
      {
        "heading": "seção 1 (só crie se houver informação suficiente)",
        "body": "conteúdo denso com números e dados"
      }
    ],
    "sourceIndexes": [1, 3, 5],
    "keywords": ["termo1", "termo2", "termo3"],
    "relevance": 0.95
  }
]

**REGRAS FINAIS:**
- Retorne EXCLUSIVAMENTE o array JSON.
- Se as fontes forem lixo (cupons, promoções vazias etc.), retorne [].
- Nunca adicione markdown, explicação ou texto fora do JSON.
- sourceIndexes: obrigatório, só as fontes realmente usadas
- keywords: 5 a 15 termos em minúsculo, separados por vírgula, otimizados para SEO
- relevance: float de 0.0 a 1.0 (seja generoso com hard news e cultura pop)

**CONTEXTO:**
- Data: ${today}
- Tópico: "${topic}"
- Artigos já publicados: ${existingContext}
- Cluster ${clusterNum}/${clusters.length}: ${clusterItems.length} fontes RELACIONADAS com até 2000 chars cada

FONTES:
${context}`

    try {
      const result = await model.generateContent(prompt)
      const response = result.response
      const text = response.text()

      // Extrai JSON da resposta (com parser robusto)
      const firstBracket = text.indexOf('[')
      const lastBracket = text.lastIndexOf(']')

      if (firstBracket === -1 || lastBracket === -1) {
        console.warn(`[${topic}] Cluster ${clusterNum}: JSON inválido`)
      } else {
        try {
          const jsonStr = text.substring(firstBracket, lastBracket + 1)
          const parsed = JSON.parse(jsonStr)

          // ✅ Marca este cluster como processado com sucesso (mesmo que 0 artigos)
          clusterSourceIds.forEach(id => allProcessedClusterSourceIds.add(id))

          // Vincula cada item ao seu cluster source_ids
          parsed.forEach(item => {
            allParsedItems.push({ item, clusterSourceIds })
          })
          console.log(`[${topic}] Cluster ${clusterNum}: ${parsed.length} artigo(s) gerado(s) ✓`)
        } catch (parseErr) {
          console.warn(`[${topic}] Cluster ${clusterNum}: Parse JSON falhou: ${parseErr.message}`)
          // NÃO marca como processado se parse falhar
        }
      }
    } catch (err) {
      // Gemini error (503, 429, etc) — NÃO marcar como processado
      const statusCode = err.status || err.message.match(/\d{3}/)
      console.error(`[${topic}] ⚠️  Erro na IA (cluster ${clusterNum}, ${statusCode}): ${err.message}. Mantendo items como não-processados para retry.`)
      throw err // Re-throw para que processTopic capture e retorne geminiError: true
    }

    // PAID TIER: Sem delay entre clusters (turbo mode!)
    if (clusterIdx < clusters.length - 1) {
      // Processamento imediato para próximo cluster
    }
  }

  // Retorna newsItems construídos com source_ids vinculados
  const now = new Date().toISOString()
  const newsItems = []

  for (const { item, clusterSourceIds } of allParsedItems) {
    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) {
      console.warn(`[${topic}] ⚠️  DESCARTE: sourceIndexes ausente/inválido em artigo gerado`)
      continue
    }

    // ✅ DERRUBE OS MUROS: Se a IA gerou, salva. Sem censura de relevância.
    // const relevance = isGeneratedItemRelevant(item, results)
    // if (!relevance) console.warn(`[${topic}] ℹ️  Relevância baixa (0.01 check) - "${item.title?.slice(0, 50)}" (PROCESSADO)`)

    // ✅ FALLBACK sourceIndexes: Se a IA não retornou, usa todas as fontes do cluster
    let idxs = (item.sourceIndexes || []).map(n => n - 1)
    if (idxs.length === 0) {
      console.warn(`[${topic}] ⚠️  sourceIndexes vazio — fallback para todas as ${results.length} fontes`)
      idxs = results.map((_, i) => i) // Todas as fontes
    }

    // ✅ Buscar imagem INDIVIDUAL por artigo (evita reutilização entre artigos)
    let imageUrl = null
    let imageSource = null
    for (const idx of idxs) {
      const candidate = results[idx]?.image
      if (candidate && !isLazyLoadImage(candidate)) {
        imageUrl = candidate
        imageSource = results[idx].url
        break
      }
    }

    // ✅ FAILSAFE: placeholder + diagnóstico
    if (!imageUrl) {
      imageUrl = `https://via.placeholder.com/1200x630?text=${encodeURIComponent(item.title?.slice(0, 30) || 'Lophos News')}`
      console.warn(`[${topic}] 📸 Placeholder — ${item.title?.slice(0, 50)} (nenhuma imagem válida em ${idxs.length} fontes)`)
    } else {
      console.log(`[${topic}] 🖼️  Imagem de: ${imageSource?.split('/')[2]}`)
    }

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
      source_ids: clusterSourceIds, // ✅ IDs reais dos raw_items (UUIDs)
    })
  }

  return { newsItems, success: true, processedClusterSourceIds: Array.from(allProcessedClusterSourceIds) }
}

async function processTopic(topic, rawItems, existingTitles) {
  const results = rawItems.map(item => ({
    url: item.url,
    title: item.title,
    content: item.content || '',
    image: item.image_url,
  }))

  if (!results.length) return { newsItems: [], success: true }

  // Map para rastrear raw_items por ID
  const rawItemsMap = new Map(rawItems.map(item => [item.id, item]))

  // ═══════════════════════════════════════════════════════════════
  // FASE 1: Clustering Inteligente
  // ═══════════════════════════════════════════════════════════════
  const clusters = await clusterRawItems(topic, rawItems)

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: Processamento de Conteúdo (por Cluster)
  // ═══════════════════════════════════════════════════════════════
  let parsed
  try {
    parsed = await processTopicWithGemini(topic, results, existingTitles, clusters, rawItemsMap)
  } catch (err) {
    // Gemini error (503, 429, etc) — NÃO marcar como processado
    const statusCode = err.status || err.message.match(/\d{3}/)
    console.error(`[${topic}] ⚠️  Erro na IA (${statusCode}): ${err.message}. Mantendo items como não-processados para retry.`)
    return { newsItems: [], success: false, geminiError: true }
  }

  // parsed contém { newsItems, success, processedClusterSourceIds }
  // ✅ Todos os clusters processados com sucesso são marcados para rastreamento
  return parsed
}

async function main() {
  // Get all distinct topics with unprocessed items
  const { data: topicRows, error: topicError } = await db
    .from('raw_items')
    .select('topic')
    .eq('processed', false)

  if (topicError) throw new Error('DB error: ' + topicError.message)
  if (!topicRows?.length) { console.log('No unprocessed items found.'); return }

  const allTopics = [...new Set(topicRows.map(r => r.topic).filter(Boolean))]

  // 🧪 TESTE: Filtrar apenas horror
  const topics = allTopics.filter(t => t === TEST_TOPIC)

  console.log(`\n🎬 HORROR TEST SUITE — Teste Isolado de Clustering`)
  console.log(`Mode: ${DRY_RUN ? '🟡 DRY RUN (simula)' : '🟢 LIVE (salva no BD)'}`)
  console.log(`Batch: ${BATCH_SIZE} items | Topic: ${TEST_TOPIC} | Delay: ${DELAY_BETWEEN_TOPICS_MS}ms`)

  if (topics.length === 0) {
    console.log(`❌ Nenhum item com topic="${TEST_TOPIC}" encontrado.`)
    console.log(`   Topics disponíveis: ${allTopics.join(', ')}`)
    return
  }

  console.log(`Topics para processar: ${topics.join(', ')}\n`)

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
      const { newsItems, success: geminiSuccess, geminiError, processedClusterSourceIds } = await processTopic(
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
      // ✅ TRANSAÇÃO: Lista limpa - APENAS IDs que foram realmente salvos com sucesso
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
              if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
                item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
              } else {
                console.warn(`[${topic}] ⚠️  source_ids inválido no merge: ${typeof item.source_ids}. Artigo salvo mas mapeamento skipped para revisão.`)
              }
            }
          } else {
            // Sem mudanças, mas merge bem-sucedido
            if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
              item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
            } else {
              console.warn(`[${topic}] ⚠️  source_ids inválido (sem mudanças): ${typeof item.source_ids}. Artigo salvo mas mapeamento skipped para revisão.`)
            }
          }
        } else {
          dedupedItems.push(item)
        }
      }

      // 🧪 TESTE: Salvar artigos (ou simular com DRY_RUN)
      if (dedupedItems.length > 0) {
        console.log(`\n[${topic}] 📦 ${dedupedItems.length} artigos novos para salvar:`)
        dedupedItems.forEach((item, i) => {
          console.log(`  ${i+1}. "${item.title}" (${item.sources.length} fontes, image: ${item.image_url?.substring(0, 40)}...)`)
        })

        let saveError = null
        if (!DRY_RUN) {
          const result = await db.from('articles').upsert(
            dedupedItems,
            { onConflict: 'id' }
          )
          saveError = result.error
        }

        if (saveError) {
          console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${dedupedItems.length} items não marcados como processados.`)
          // NÃO marca como processado se houver erro
        } else {
          if (DRY_RUN) {
            console.log(`[${topic}] 🟡 DRY RUN: ${dedupedItems.length} artigos SIM seriam salvos`)
          } else {
            console.log(`[${topic}] ✅ ${dedupedItems.length} artigos salvos com sucesso`)
          }
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
            if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
              item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
            } else {
              console.warn(`[${topic}] ⚠️  source_ids inválido no novo artigo: ${typeof item.source_ids}. Artigo salvo mas mapeamento skipped para revisão.`)
            }
          }
          console.log(`  ✓ ${dedupedItems.length} artigos salvos`)
        }
      }

      totalGenerated += dedupedItems.length

      // ✅ Confirmação de Escrita (com DRY_RUN)
      if (successfullyProcessedRawIds.size > 0) {
        console.log(`[${topic}] 🔄 Marcando ${successfullyProcessedRawIds.size} raw_items como processados...`)
        if (DRY_RUN) {
          console.log(`[${topic}] 🟡 DRY RUN: SIM marcaria ${successfullyProcessedRawIds.size} IDs como processed=true`)
        }

        if (!DRY_RUN) {
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
        }
      } else {
        console.warn(`[${topic}] ⚠️  Nenhum item marcado como processado (verifique source_ids na resposta da IA ou clustering)`)
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

  const totalProcessed = totalSaved + totalMerged
  const backlogReduction = totalProcessed > 0 ? `651 → ~${Math.max(0, 651 - totalProcessed)}` : 'N/A'
  console.log(`\n✨ FAXINA CONCLUÍDA!`)
  console.log(`Topics: ${topics.length} | Artigos gerados: ${totalGenerated} | Salvos: ${totalSaved} | Merges: ${totalMerged}`)
  console.log(`Backlog reduzido: ${backlogReduction} notícias`)
  console.log(`Total processado com sucesso: ${totalProcessed} notícias 🎉\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
