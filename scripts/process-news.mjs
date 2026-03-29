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
const GROQ_MODEL_FALLBACK = 'llama-3-8b-8192'
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

  const prompt = `Você é um Editor Sênior de um feed de notícias em tempo real no estilo exato do Perplexity Discover: textos curtos, impactantes, bem estruturados, com tom jornalístico empolgado mas factual.

**CONTEXTO ATUAL:**
- Data atual: ${today}
- Tópico principal: "${topic}"
- Conteúdo já publicado: ${existingContext}
- Fontes disponíveis: ${context}

**REGRAS RÍGIDAS:**
- Unicidade de Evento: Cada notícia deve cobrir **apenas UM evento principal** claro e independente. É permitido (e desejado) ter várias seções dentro da mesma notícia falando de aspectos diferentes do MESMO evento (ex: elenco + data de estreia + repercussão). O que é PROIBIDO é misturar eventos completamente diferentes (ex: não colocar notícia de Homem-Aranha junto com American Horror Story ou política no mesmo objeto JSON).
- Foque em anúncios oficiais, lançamentos, patches, revelações de elenco, trailers, resultados importantes, etc. Descarte guias, fóruns, wikis, apostas, quizzes e conteúdo irrelevante.
- **Filtro Anti-Promoção:** Descarte qualquer item cujo objetivo principal seja venda direta, cupom ou oferta de varejo (ex: "Placa de vídeo com 20% OFF na Amazon", "Console em promoção hoje"). A Regra de Ouro: se a "notícia" deixaria de existir quando o desconto acabasse, descarte. Se a informação continua relevante independente do preço (lançamento, análise técnica, atualização, mudança de elenco), mantenha — mesmo que mencione preços. Em caso de dúvida, mantenha.
- Use nomes, números e termos técnicos **exatamente** como aparecem nas fontes (não parafraseie).
- Cruze informações de múltiplas fontes quando possível. Só inclua no sourceIndexes as fontes que realmente tratam do evento.
- **Prevenção de Duplicidade ABSOLUTA:** Se o evento já consta em \`${existingContext}\`, ignore-o **mesmo que ele tenha sido publicado em uma categoria diferente** (ex: uma notícia de Harry Potter publicada em "movies" não deve ser republicada em "cultura" ou qualquer outro tópico). Se não houver fatos novos ou noticiáveis, retorne apenas \`[]\`.

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
- \`sourceIndexes\`: Array de inteiros referenciando apenas fontes pertinentes ao evento.
- \`keywords\`: Array de 5 a 15 termos em **letras minúsculas** para descoberta e matching. Inclua obrigatoriamente: o tópico geral (ex: "games"), entidades específicas do artigo (nomes de jogos, filmes, pessoas, eventos, times), termos relacionados que um usuário poderia cadastrar (ex: "valorant", "vct 2026", "masters bangkok", "riot games", "esports"), e variações em pt-BR e inglês quando relevante.

**INSTRUÇÕES DE PROFUNDIDADE:**
- Extraia informações COMPLETAS de cada fonte.
- Não resuma em uma frase; desenvolva a seção com detalhes, contexto e impacto.
- Use citações diretas das fontes quando apropriado.
- Cada seção deve antecipar perguntas que um leitor faria.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON válido. Não inclua markdown, comentários ou texto fora do JSON. Se não houver conteúdo válido, retorne \`[]\`.

[{"title":"...","summary":"...","sections":[{"heading":"...","body":"Conteúdo substancial com múltiplas linhas de detalhes..."}],"sourceIndexes":[1,2],"keywords":["games","valorant","vct 2026","masters bangkok","esports","riot games"]}]

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
    // Se receber erro 429 (Rate Limit), tenta com o modelo 8B
    if (err.status === 429) {
      console.log(`[${topic}] Limite atingido no 70B, tentando fallback com 8B...`)
      try {
        return await callGroqApi(GROQ_MODEL_FALLBACK, topic, results, existingTitles)
      } catch (fallbackErr) {
        console.error(`[${topic}] Fallback com 8B também falhou:`, fallbackErr.message || fallbackErr)
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
