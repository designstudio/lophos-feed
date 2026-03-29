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
const MINIBATCH_DELAY_MS = 5_000 // 5s delay between mini-batches to prevent API strain
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

async function callGroqApi(model, topic, results, existingTitles) {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const context = results.map((r, i) =>
    `[${i + 1}] ${new URL(r.url).hostname.replace('www.', '')} — "${r.title}"\n${(r.content || '').slice(0, CONTENT_CHARS)}`
  ).join('\n\n')

  const existingContext = existingTitles.length > 0
    ? `\nNOTÍCIAS JÁ PUBLICADAS (NÃO repita estes eventos):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : ''

  const sourceHint = getSourceHint(topic)

  const prompt = `Você é o Curador-Chefe do Lophos, um hub de inteligência focado em eficiência e clareza. Sua missão é destilar o conteúdo bruto em um resumo que respeite o tempo do leitor e a alma da fonte original.

**CONTEXTO:**
- Data atual: ${today}
- Tópico: "${topic}"
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
- \`sourceIndexes\`: Apenas fontes que realmente cobrem este evento.
- \`keywords\`: 5-15 termos específicos em minúsculas.

**FILTRAGEM OBRIGATÓRIA:**
- Descarte vendas, cupons, ofertas (se deixaria de existir sem o desconto).
- Mantenha lançamentos, análises técnicas, atualizações.
- Cada notícia = UM evento principal. Nunca misture eventos diferentes.
- Se o evento já foi publicado (mesmo em tópico diferente), retorne \`[]\`.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Sem markdown, sem comentários. Se não houver conteúdo válido, retorne \`[]\`.

**⚠️ VERIFICAÇÃO FINAL ANTES DE RETORNAR:**
1. Cada resumo contém dados específicos (números, mudanças técnicas, citações)?
2. Nenhum resumo é uma única frase genérica?
3. Se a fonte menciona: "Patch 2.5 aumenta dano em 15%", isso está no seu resumo (não "a comunidade gostou")?
4. Se a fonte menciona citação de usuário/expert, reproduza ou parafraseie fielmente (não summarize como "as pessoas concordam")?

Se a resposta for NÃO para alguma pergunta, revise. Um resumo sem dados específicos é uma falha.

Você tem 2000 caracteres de contexto real. Use cada um deles. Não use clichês para preencher o vazio.

FONTES:
${context}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    const status = res.status
    const err = await res.text()
    throw { status, message: `Groq error ${status}: ${err.slice(0, 200)}` }
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    return JSON.parse(match[0])
  } catch {
    return []
  }
}

// FASE 1: Agrupamento leve por títulos (apenas títulos e URLs)
async function groupEventsByTitles(topic, results) {
  const titlesContext = results.map((r, i) =>
    `[${i + 1}] "${r.title}" (${new URL(r.url).hostname.replace('www.', '')})`
  ).join('\n')

  const phase1Prompt = `Você é um analisador de eventos para deduplicação. Analise estes títulos e agrupe as URLs que cobrem o MESMO evento.

TÍTULOS:
${titlesContext}

RESPOSTA: Retorne EXCLUSIVAMENTE um JSON com este formato (sem markdown):
{
  "groups": [
    {
      "event": "Descrição breve do evento",
      "urlIndexes": [1, 3, 5]
    },
    {
      "event": "Outro evento diferente",
      "urlIndexes": [2, 4]
    }
  ]
}

Regras:
- Cada grupo = UM evento independente
- Retorne APENAS um array JSON válido, nada mais
- Se não conseguir agrupar, retorne: {"groups": []}`

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
      const err = await res.text()
      console.error(`[${topic}] Fase 1 error: ${res.status}`)
      // Fallback: criar grupos individuais se Fase 1 falhar
      return results.map((_, i) => ({ event: 'Evento', urlIndexes: [i + 1] }))
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? ''
    const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
    if (!match) return results.map((_, i) => ({ event: 'Evento', urlIndexes: [i + 1] }))

    const parsed = JSON.parse(match[0])
    return parsed.groups || results.map((_, i) => ({ event: 'Evento', urlIndexes: [i + 1] }))
  } catch (err) {
    console.error(`[${topic}] Fase 1 exception:`, err.message)
    return results.map((_, i) => ({ event: 'Evento', urlIndexes: [i + 1] }))
  }
}

// FASE 2: Processamento denso de cada evento agrupado
async function processEventGroup(topic, group, results, existingTitles) {
  const groupResults = group.urlIndexes
    .map(idx => results[idx - 1])
    .filter(r => r)

  if (!groupResults.length) return []

  const context = groupResults.map((r, i) =>
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
- Evento: ${group.event}
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
- \`sourceIndexes\`: Array contendo números de 1 a ${groupResults.length}, referenciando as fontes deste grupo.
- \`keywords\`: 5-15 termos específicos em minúsculas.

**FILTRAGEM OBRIGATÓRIA:**
- Descarte vendas, cupons, ofertas (se deixaria de existir sem o desconto).
- Mantenha lançamentos, análises técnicas, atualizações.
- Se o evento já foi publicado (mesmo em tópico diferente), retorne \`[]\`.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Sem markdown, sem comentários. Se não houver conteúdo válido, retorne \`[]\`.

**⚠️ VERIFICAÇÃO FINAL ANTES DE RETORNAR:**
1. Cada resumo contém dados específicos (números, mudanças técnicas, citações)?
2. Nenhum resumo é uma única frase genérica?
3. Se a fonte menciona números ou mudanças técnicas, elas estão no resumo?

Se a resposta for NÃO para alguma pergunta, revise. Um resumo sem dados específicos é uma falha.

Você tem contexto real das ${groupResults.length} fonte(s). Use cada bit deles. Não use clichês para preencher o vazio.

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
      throw { status, message: `Groq error ${status}` }
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

async function callGroqWithFallback(topic, results, existingTitles) {
  try {
    // Tenta primeiro com o modelo 70B
    return await callGroqApi(GROQ_MODEL_PRIMARY, topic, results, existingTitles)
  } catch (err) {
    // Se receber erro 429 (Rate Limit), tenta com o modelo fallback
    if (err.status === 429) {
      console.log(`[${topic}] Limite atingido no 70B, tentando fallback com llama-3.1-8b-instant...`)
      try {
        return await callGroqApi(GROQ_MODEL_FALLBACK, topic, results, existingTitles)
      } catch (fallbackErr) {
        console.error(`[${topic}] Fallback com ${GROQ_MODEL_FALLBACK} também falhou:`, fallbackErr.message || fallbackErr)
        return []
      }
    }
    // Outros erros: apenas loga e retorna array vazio
    console.error(`[${topic}] Erro ao processar:`, err.message || err)
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

  // FASE 1: Agrupamento leve por títulos
  console.log(`[${topic}] Fase 1: Agrupando eventos por títulos...`)
  const eventGroups = await groupEventsByTitles(topic, results)
  console.log(`[${topic}] Fase 1: ${eventGroups.length} grupos identificados`)

  const now = new Date().toISOString()
  const newsItems = []

  // FASE 2: Processamento de cada grupo
  for (let gi = 0; gi < eventGroups.length; gi++) {
    const group = eventGroups[gi]
    console.log(`[${topic}] Fase 2 (${gi + 1}/${eventGroups.length}): Processando "${group.event}"...`)

    const parsed = await processEventGroup(topic, group, results, existingTitles)

    // Pequeno delay entre grupos
    if (gi < eventGroups.length - 1) {
      await new Promise(r => setTimeout(r, MINIBATCH_DELAY_MS))
    }

    for (const item of parsed) {
      if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) continue

      // Ajusta sourceIndexes para índices reais (os índices vêm do grupo)
      const groupIdxs = group.urlIndexes.map(i => i - 1)
      const itemIdxs = item.sourceIndexes.map(n => groupIdxs[n - 1]).filter(i => i !== undefined)

      if (!itemIdxs.length) continue
      if (!isGeneratedItemRelevant(item, results)) continue

      // Find first valid image
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
