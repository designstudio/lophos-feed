/**
 * Standalone Groq processing script — runs directly with Node.js (no Next.js needed).
 * Used by GitHub Actions every 6 hours, after rss-ingest.mjs.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GROQ_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const GROQ_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL_PRIMARY = 'llama-3.3-70b-versatile'
const GROQ_MODEL_FALLBACK = 'llama-3.1-8b-instant'
const BATCH_SIZE = 15       // max sources per Groq call
const CONTENT_CHARS = 2000  // chars per source — sweet spot: enough context without API bloat
const TPM_COOLDOWN_MS = 65_000 // 65s between calls — respects 12k TPM free tier
const PHASE2_DELAY_MS = 18_000 // 18s delay between Phase 2 events (Groq free tier: devagar e sempre)
const RATE_LIMIT_RETRY_DELAY_MS = 30_000 // 30s wait before retry on 429
const MAX_RETRIES = 3 // Max retry attempts on 429 error
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


// FASE 1: Triagem Leve (Metadados) — Agrupa TODOS os títulos em UMA requisição
async function triageMetadataPhase(topic, results) {
  if (!results.length) return []

  console.log(`[${topic}] Fase 1: Triagem de metadados (${results.length} fontes)...`)

  const titlesContext = results.map((r, i) =>
    `[${i + 1}] "${r.title}" (${new URL(r.url).hostname.replace('www.', '')})`
  ).join('\n')

  const phase1Prompt = `Você é um analisador de eventos para deduplicação. Analise estes títulos e agrupe as URLs que cobrem o MESMO evento real.

TÍTULOS E FONTES:
${titlesContext}

RESPOSTA: Retorne EXCLUSIVAMENTE um JSON (sem markdown, sem comentários):
{
  "events": [
    {
      "name": "Descrição breve e clara do evento",
      "sourceIndexes": [1, 3, 5]
    },
    {
      "name": "Outro evento independente",
      "sourceIndexes": [2, 4]
    }
  ]
}

Regras RÍGIDAS:
- Cada evento = UM assunto independente (não misture)
- sourceIndexes usa os números [1-${results.length}] dos títulos acima
- Se um título é sobre "Novo patch do Valorant", agrupe com outros sobre o mesmo patch
- Se é sobre "Novo skin do Valorant", é EVENTO DIFERENTE
- Retorne APENAS o JSON válido, nada mais
- Se não conseguir agrupar, retorne: {"events": []}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL_PRIMARY,
        messages: [{ role: 'user', content: phase1Prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    })

    if (!res.ok) {
      const status = res.status
      const err = await res.text()
      console.error(`[${topic}] Fase 1 error ${status}`)
      // Fallback: criar evento individual para cada fonte
      return results.map((r, i) => ({ name: r.title, sourceIndexes: [i + 1] }))
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''
    const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn(`[${topic}] Fase 1: Nenhuma resposta válida, criando eventos individuais`)
      return results.map((r, i) => ({ name: r.title, sourceIndexes: [i + 1] }))
    }

    const parsed = JSON.parse(match[0])
    const events = parsed.events || []

    if (!events.length) {
      return results.map((r, i) => ({ name: r.title, sourceIndexes: [i + 1] }))
    }

    console.log(`[${topic}] Fase 1: ${events.length} evento(s) identificado(s)`)
    return events
  } catch (err) {
    console.error(`[${topic}] Fase 1 exception:`, err.message)
    return results.map((r, i) => ({ name: r.title, sourceIndexes: [i + 1] }))
  }
}

// FASE 2: Processamento Denso (Conteúdo) — Processa cada evento com conteúdo completo + Retry Logic
async function processDensePhaseWithRetry(topic, event, results, existingTitles, attempt = 1) {
  try {
    return await processDensePhase(topic, event, results, existingTitles)
  } catch (err) {
    // Se for erro 429 (Rate Limit) e ainda temos tentativas
    if (err.status === 429 && attempt < MAX_RETRIES) {
      const waitTime = RATE_LIMIT_RETRY_DELAY_MS / 1000
      console.warn(`[${topic}] Erro 429 na tentativa ${attempt}/${MAX_RETRIES}. Aguardando ${waitTime}s antes de tentar novamente...`)
      await new Promise(r => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS))
      return processDensePhaseWithRetry(topic, event, results, existingTitles, attempt + 1)
    }

    // Se esgotou as tentativas ou é outro erro
    if (err.status === 429) {
      console.error(`[${topic}] Erro 429 após ${MAX_RETRIES} tentativas. Pulando evento.`)
    } else {
      console.error(`[${topic}] Erro ao processar evento:`, err.message)
    }
    return []
  }
}

async function processDensePhase(topic, event, results, existingTitles) {
  const eventSourceIndexes = event.sourceIndexes || []
  const eventResults = eventSourceIndexes
    .map(idx => results[idx - 1])
    .filter(r => r)

  if (!eventResults.length) return []

  console.log(`[${topic}] Fase 2: Processando "${event.name}" (${eventResults.length} fonte(s))...`)

  // Monta contexto denso com conteúdo completo de cada fonte
  const context = eventResults.map((r, i) =>
    `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, 2000)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita estes eventos):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const prompt = `Você é o Curador-Chefe do Lophos, um hub de inteligência focado em eficiência e clareza. Sua missão é destilar o conteúdo bruto em um resumo que respeite o tempo do leitor e a alma da fonte original.

**CONTEXTO:**
- Data atual: ${today}
- Tópico: "${topic}"
- Evento: ${event.name}
- Conteúdo já publicado: ${existingContext}
- Fontes disponíveis (conteúdo completo): ${context}

**DIRETRIZES DE CONTEÚDO:**

**Fidelidade à Substância (O "Sumo"):**
- Comece sempre pelo fato, história ou conceito mais impactante.
- Exemplo: Se o texto fala de uma escola militar sobrenatural em 1910, isso vem antes da data de estreia. Se fala de inflação, o preço no bolso vem antes do nome do ministro.
- O que o leitor precisa saber primeiro? Coloque lá.

**Preservação do Colorido Original:**
- Se o autor usou uma analogia única (ex: "é como um cereal genérico") ou um tom específico, mantenha isso.
- Não neutralize nem "limpe" a personalidade da fonte.
- Se o texto é sarcástico, mantenha o sarcasmo. Se é técnico e denso, mantenha a densidade.

**Banimento de Clichês IA:**
É TERMINANTEMENTE PROIBIDO usar frases como:
- "Em uma nova era", "O futuro promete", "Um lembrete de"
- "A equipe trabalha arduamente", "Os fãs estão ansiosos"
- "Abrindo novos caminhos", "Mudando o jogo", "Quebrando barreiras"
- "Inovador", "revolucionário", "nunca antes visto"
Se não for um fato ou opinião explícita da fonte, delete.

**Tom "Colega Especialista":**
- Escreva como um profissional resumindo um artigo para outro colega pelo Slack.
- Direto, sem enrolação e sem "introduções de redação escolar".
- Informal é aceitável. Robótico é proibido.

**ESTRUTURA JSON:**
- \`title\`: Direto, usando termos literais da fonte em pt-BR.
- \`summary\`: Um parágrafo denso (2-4 frases). Proibido introduções genéricas. Vá direto ao ponto principal.
  **⚠️ OBRIGATÓRIO:** Se a fonte menciona números (datas, valores, placares, estatísticas), mudanças técnicas (patch notes, features, algoritmos), ou citações (de fãs, experts, desenvolvedores), esses dados DEVEM estar no resumo. Um resumo sem dados específicos é considerado uma falha.
  **⚠️ NÃO FAÇA:** Resumos de uma única frase. Isso é insuficiente.
  Exemplo RUIM: "Os fãs estão felizes com a mudança."
  Exemplo BOM: "Os desenvolvedores aumentaram o dano do personagem em 15% (de 20 para 23 por hit), uma mudança que os fãs pediam há meses."
- \`sections\`: 1 a 3 seções (apenas o necessário). Não invente texto para preencher espaço. Qualidade sobre quantidade.
- \`sourceIndexes\`: Array com números 1 a ${eventResults.length}, referenciando as fontes deste evento.
- \`keywords\`: 5-15 termos específicos em minúsculas.

**FILTRAGEM OBRIGATÓRIA:**
- Descarte vendas, cupons, ofertas (se deixaria de existir sem o desconto).
- Mantenha lançamentos, análises técnicas, atualizações.
- Se o evento já foi publicado (mesmo em tópico diferente), retorne \`[]\`.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Sem markdown, sem comentários. Se não houver conteúdo válido, retorne \`[]\`.

**⚠️ VERIFICAÇÃO FINAL ANTES DE RETORNAR:**
1. O resumo contém dados específicos (números, mudanças técnicas, citações)?
2. O resumo NÃO é uma única frase genérica?
3. Se as fontes mencionam números ou mudanças técnicas, elas estão no resumo?

Um resumo sem dados específicos é considerado uma falha.

Você tem conteúdo denso das ${eventResults.length} fonte(s) sobre este evento. Use-o. Não use clichês para preencher o vazio.

FONTES:
${context}`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL_PRIMARY,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!res.ok) {
      const status = res.status
      const err = await res.text()
      const error = new Error(`Groq error ${status}`)
      error.status = status
      throw error
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''
    const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
    if (!match) return []

    return JSON.parse(match[0])
  } catch (err) {
    console.error(`[${topic}] Fase 2 error:`, err.message)
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

  // ═══════════════════════════════════════════════════════════════
  // FASE 1: TRIAGEM DE METADADOS (Leve) — Agrupa TODOS os títulos
  // ═══════════════════════════════════════════════════════════════
  const events = await triageMetadataPhase(topic, results)

  if (!events.length) {
    console.log(`[${topic}] Nenhum evento identificado na Fase 1`)
    return []
  }

  const now = new Date().toISOString()
  const newsItems = []

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: PROCESSAMENTO DENSO (Conteúdo) — Processa cada evento
  // ═══════════════════════════════════════════════════════════════

  // Opcional: Agrupa eventos com 1 fonte para economizar requisições (batching 2x2)
  const eventGroups = []
  for (let ei = 0; ei < events.length; ei++) {
    const event = events[ei]
    const isSmall = (event.sourceIndexes || []).length === 1
    const nextEvent = events[ei + 1]
    const nextIsSmall = nextEvent && (nextEvent.sourceIndexes || []).length === 1

    // Se ambos são pequenos, agrupa
    if (isSmall && nextIsSmall) {
      eventGroups.push({ type: 'batch', events: [event, nextEvent] })
      ei++ // pula o próximo já que foi agrupado
    } else {
      eventGroups.push({ type: 'single', events: [event] })
    }
  }

  // Processa cada grupo
  for (let gi = 0; gi < eventGroups.length; gi++) {
    const group = eventGroups[gi]

    if (group.type === 'batch') {
      console.log(`[${topic}] Fase 2: Processando BATCH de 2 eventos pequenos...`)
      // Processa ambos os eventos (em sequência com retry)
      for (const event of group.events) {
        const parsed = await processDensePhaseWithRetry(topic, event, results, existingTitles)
        // Adiciona resultados
        newsItems.push(...extractNewsItems(parsed, event.sourceIndexes, results, topic, now, existingTitles))

        // Delay entre eventos dentro do batch
        if (group.events.indexOf(event) < group.events.length - 1) {
          await new Promise(r => setTimeout(r, PHASE2_DELAY_MS))
        }
      }
    } else {
      // Evento único
      const event = group.events[0]
      const parsed = await processDensePhaseWithRetry(topic, event, results, existingTitles)
      newsItems.push(...extractNewsItems(parsed, event.sourceIndexes, results, topic, now, existingTitles))
    }

    // Delay entre grupos
    if (gi < eventGroups.length - 1) {
      console.log(`[${topic}] Aguardando ${PHASE2_DELAY_MS / 1000}s antes do próximo evento (Groq free tier)...`)
      await new Promise(r => setTimeout(r, PHASE2_DELAY_MS))
    }
  }

  return newsItems
}

// Helper: Extrai news items de um resultado parseado
function extractNewsItems(parsed, eventSourceIndexes, results, topic, now, existingTitles) {
  const newsItems = []
  const eventIdxs = eventSourceIndexes || []

  for (const item of parsed) {
    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) continue

    // Mapeia sourceIndexes para índices reais do evento
    const itemIdxs = item.sourceIndexes
      .map(n => {
        const eventIdx = eventIdxs[n - 1]
        return eventIdx ? eventIdx - 1 : undefined
      })
      .filter(i => i !== undefined)

    if (!itemIdxs.length) continue
    if (!isGeneratedItemRelevant(item, results)) continue

    // Busca primeira imagem válida
    let imageUrl
    for (const idx of itemIdxs) {
      const candidate = results[idx]?.image
      if (candidate && !isLazyLoadImage(candidate)) { imageUrl = candidate; break }
    }
    if (!imageUrl) continue

    const sources = itemIdxs
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
  console.log(`Topics to process: ${topics.join(', ')}`)

  // 1. Busca global de títulos + ids + sources + keywords + matched_topics das últimas 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: globalExisting } = await db
    .from('articles')
    .select('id, title, sources, keywords, matched_topics')
    .gte('published_at', since24h)
    .order('published_at', { ascending: false })
    .limit(100)

  // allProcessedArticles: cache local atualizado em tempo real a cada tópico processado
  const allProcessedArticles = (globalExisting || []).map(r => ({
    id: r.id,
    title: r.title,
    sources: r.sources || [],
    keywords: r.keywords || [],
    matched_topics: r.matched_topics || [],
  }))
  console.log(`Artigos existentes (últimas 24h): ${allProcessedArticles.length}`)

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

      console.log(`\n[${topic}] ${rawItems.length} items → Groq (${GROQ_MODEL_PRIMARY})...`)
      const newsItems = await processTopic(topic, rawItems, allProcessedArticles.map(a => a.title))

      // Small delay between API calls to prevent strain
      await new Promise(r => setTimeout(r, MINIBATCH_DELAY_MS))

      const dedupedItems = []

      for (const item of newsItems) {
        // Verifica similaridade com todos os artigos já conhecidos
        const match = allProcessedArticles.find(
          existing => textOverlapScore(item.title, existing.title) >= SIMILARITY_THRESHOLD
        )

        if (match) {
          // Merge de fontes: adiciona apenas URLs ainda não presentes
          const existingUrls = new Set((match.sources || []).map(s => s.url))
          const newSources = item.sources.filter(s => !existingUrls.has(s.url))

          // Merge de keywords e matched_topics via Set (sem repetição)
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
              console.error(`[${topic}] Merge error em "${match.title}":`, mergeError.message)
            } else {
              // Atualiza cache local
              match.sources = mergedSources
              match.keywords = mergedKeywords
              match.matched_topics = mergedMatchedTopics
              totalMerged++
              console.log(`[${topic}] Merge em "${match.title}": +${newSources.length} fonte(s), +${mergedKeywords.length - (match.keywords.length - (mergedKeywords.length - match.keywords.length))} keyword(s)`)
            }
          } else {
            console.log(`[${topic}] Ignorado (sem dados novos): "${item.title}"`)
          }
        } else {
          dedupedItems.push(item)
        }
      }

      console.log(`[${topic}] Novos: ${dedupedItems.length} | Merges: ${newsItems.length - dedupedItems.length}`)

      if (dedupedItems.length > 0) {
        const { error: saveError } = await db.from('articles').upsert(
          dedupedItems,
          { onConflict: 'id' }
        )
        if (saveError) {
          console.error(`[${topic}] Save error:`, saveError.message)
        } else {
          totalSaved += dedupedItems.length
          // Alimenta o cache com os novos artigos desta iteração
          for (const item of dedupedItems) {
            allProcessedArticles.push({
              id: item.id,
              title: item.title,
              sources: item.sources,
              keywords: item.keywords || [],
              matched_topics: item.matched_topics || [],
            })
          }
        }
      }

      // Mark all fetched items as processed
      await db.from('raw_items').update({ processed: true })
        .eq('topic', topic)
        .eq('processed', false)

      totalGenerated += dedupedItems.length

      // Delay apenas se houver um próximo tópico (economiza minutos do Actions no último)
      if (ti < topics.length - 1) {
        console.log(`\nAguardando ${TPM_COOLDOWN_MS / 1000}s para respeitar o rate limit do Groq...`)
        await new Promise(r => setTimeout(r, TPM_COOLDOWN_MS))
      }
    } catch (err) {
      console.error(`[${topic}] Error:`, err.message)
    }
  }

  console.log(`\nDone! topics=${topics.length} generated=${totalGenerated} saved=${totalSaved} merges=${totalMerged}`)
}

main().catch(err => { console.error(err); process.exit(1) })
