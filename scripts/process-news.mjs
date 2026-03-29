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
const CONTENT_CHARS = 500   // chars per source — primeiro parágrafo completo
const TPM_COOLDOWN_MS = 65_000 // 65s between calls — respects 12k TPM free tier
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

  const prompt = `Você é um curador de notícias — alguém que resume e estrutura informações como um profissional de tecnologia falando com um colega. Direto, sem enrolação, focado no que realmente importa.

**CONTEXTO:**
- Data atual: ${today}
- Tópico: "${topic}"
- Conteúdo já publicado: ${existingContext}
- Fontes disponíveis: ${context}

**FIDELIDADE AO CONTEÚDO (Prioridade 1):**
- Extraia o que o autor da fonte considerou mais relevante: analogias, exemplos específicos, bastidores, comparações.
- Se uma fonte usa uma analogia para explicar algo (ex: "X é como um cereal porque..."), preserve essa linguagem, não parafraseie.
- Evite resumos genéricos; mantenha os detalhes que diferenciam a análise.
- Use nomes, números e termos técnicos **exatamente** como aparecem nas fontes.

**FILTRO ANTI-CLICHÊ (Obrigatório):**
- NUNCA comece com: "Em um mundo onde...", "A nova era de...", "A transformação digital de...", etc.
- NUNCA termine com: "Resta saber como isso afetará o futuro", "O tempo dirá", "A tendência é clara".
- Vá direto ao ponto. Se o assunto é opinião, comece com a posição do autor. Se é hard news, comece com o dado mais impactante.

**FLEXIBILIDADE DE ESTILO:**
- **Se opinião/review/análise:** Preserve os argumentos e comparações do autor. Mantenha a voz dele.
- **Se hard news/fatos:** Seja objetivo. Destaque o dado ou resultado mais impactante primeiro, depois contexto.
- **Se notícia mista:** Combine ambas as abordagens naturalmente.

**LINGUAGEM:**
- Tom direto e moderno, como um profissional escrevendo para um colega.
- Sem termos excessivamente formais ou robóticos.
- Linguagem fluida, mas concisa.

**ESTRUTURA OBRIGATÓRIA:**
- **Unicidade:** Cada notícia = UM evento principal claro. Seções podem cobrir aspectos diferentes do MESMO evento (elenco + data + repercussão). Nunca misture eventos diferentes.
- **Filtro Anti-Promoção:** Descarte vendas, cupons, ofertas (se deixaria de existir sem o desconto). Mantenha lançamentos, análises técnicas, atualizações.
- **Deduplicação:** Se o evento já foi publicado (mesmo em tópico diferente), retorne \`[]\`.

**FORMATO JSON OBRIGATÓRIO:**
- \`title\`: Direto em pt-BR, termos literais da fonte.
- \`summary\`: 4-5 frases, incluindo frases diretas das fontes. Comece pelo ponto principal.
- \`sections\`: 2-4 seções com \`heading\` e \`body\`. Cada \`body\` deve ter 3-5 linhas de conteúdo substancial.
- \`sourceIndexes\`: Apenas fontes que realmente cobrem este evento.
- \`keywords\`: 5-15 termos em minúsculas (tópico geral, entidades específicas, variações pt-BR/EN).

**PROCESSO:**
1. Identifique eventos independentes nas fontes.
2. Filtre conteúdo irrelevante (guias, fóruns, wikis, apostas, promoções).
3. Cruze informações entre fontes quando fizerem sentido.
4. Escreva como se estivesse resumindo para um colega — sem floreios.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Sem markdown, sem comentários. Se não houver conteúdo válido, retorne \`[]\`.

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

  const parsed = await callGroqWithFallback(topic, results, existingTitles)
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

    // Build matched_topics from Gemini keywords, falling back to topic
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
