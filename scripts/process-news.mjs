/**
 * LEGACY news pipeline.
 *
 * This file kept the original monolithic implementation used before the
 * pipeline was split into preflight, cluster and Gemini runner stages.
 * The active cron path no longer imports this file.
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { clusterDeterministicItems, preflightRawItems } from './news-pipeline-core.mjs'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// PAID TIER: Gemini 2.5 Flash-Lite para TUDO (ilimitado, mais barato)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite'
})

const BATCH_SIZE = 100         // MODO FAXINA: Máximo items por tópico (651 notícias em 1 rodada!)
const CONTENT_CHARS = 2000     // chars per source (optimal detail level)
const DELAY_BETWEEN_TOPICS_MS = 100   // 100ms between topics (ultra-turbo: 4K RPM ilimitado)
const DELAY_BETWEEN_CLUSTERS_MS = 0   // ZERO DELAY: Process instantly
const PROCESS_LOOKBACK_HOURS = 12
const LAZY_IMAGE_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif', 'favicon', '/favicon', 'apple-touch-icon', 'logo-icon']

const HARD_BLOCK_PATTERNS = [
  /\bcasino(s)?\b/i,
  /\bcassino(s)?\b/i,
  /\bgambling\b/i,
  /\bbet(ting)?\b/i,
  /\bapostas?\b/i,
  /\bslots?\b/i,
  /\bpoker\b/i,
  /\broulette\b/i,
  /\broleta\b/i,
  /\bjackpot\b/i,
  /\bbonus\b/i,
  /\bb[oô]nus\b/i,
  /\bno deposit\b/i,
  /\bsem dep[oó]sito\b/i,
  /\bsweepstakes?\b/i,
  /\bbookmaker\b/i,
  /\bcassino online\b/i,
]

const DEAL_HINT_PATTERNS = [
  /\bdesconto\b/i,
  /\bdescontos\b/i,
  /\bpromo(cao|ção|coes|ções)\b/i,
  /\boferta(s)?\b/i,
  /\bcupom(ns)?\b/i,
  /\bcoupon(s)?\b/i,
  /\bblack friday\b/i,
  /\bdeal(s)?\b/i,
  /\bliquida(cao|ção)\b/i,
  /\bfrete gr[aá]tis\b/i,
  /\bgr[aá]tis\b/i,
  /\beconomize\b/i,
  /\bimperd[ií]vel\b/i,
  /\bmais barato\b/i,
  /\bmenor pre[cç]o\b/i,
  /\bpre[cç]o baixo\b/i,
  /\bpor r\$/i,
  /\bpor us\$/i,
  /\b\d{1,3}%\s*(off|de desconto)\b/i,
]

const DEAL_SOURCE_HINTS = [
  'promobit',
  'pelando',
  'buscape',
  'zoom.com',
  'cuponomia',
  'meliuz',
]

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

function shouldRejectContent({ title, summary = '', sections = [], urls = [], sourceNames = [], rawTexts = [] }) {
  const sectionText = Array.isArray(sections)
    ? sections.map(section => `${section?.heading || ''} ${section?.body || ''}`).join(' \n ')
    : ''

  const haystack = [
    title,
    summary,
    sectionText,
    ...urls,
    ...sourceNames,
    ...rawTexts,
  ].filter(Boolean).join(' \n ').toLowerCase()

  if (countMatches(haystack, HARD_BLOCK_PATTERNS) >= 1) {
    return { reject: true, reason: 'blocked-gambling' }
  }

  const dealSignals = countMatches(haystack, DEAL_HINT_PATTERNS)
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => haystack.includes(hint))

  if (dealSignals >= 2 || (dealSignals >= 1 && sourceLooksPromo)) {
    return { reject: true, reason: 'blocked-deal' }
  }

  return { reject: false, reason: null }
}

function isLazyLoadImage(url) {
  if (!url) return false
  return LAZY_IMAGE_PATTERNS.some(p => url.toLowerCase().includes(p))
}

// Busca og:image da URL (fallback para imagens não encontradas no RSS)
async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null

    let html = ''
    const reader = res.body.getReader()
    while (html.length < 50000) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
      if (html.includes('og:image') && html.includes('</head>')) break
    }
    reader.cancel()

    let match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)

    let imageUrl = match?.[1]

    // Fallback: se não encontrou meta tags, tenta extrair de HTML direto
    if (!imageUrl) {
      // Tenta <figure> > <img>
      match = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl) {
      // Tenta <picture> > <img>
      match = html.match(/<picture[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl) {
      // Tenta primeira <img> tag direto
      match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl || LAZY_IMAGE_PATTERNS.some(p => imageUrl.toLowerCase().includes(p))) return null
    try { return new URL(imageUrl, url).href } catch { return imageUrl }
  } catch {
    return null
  }
}

// Stopwords PT + EN + palavras de formato editorial e plataformas de streaming
const STOPWORDS = new Set([
  // Português — artigos, preposições, pronomes, verbos comuns
  'o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'por','para','com','sem','sob','sobre','entre','ate','apos','que','se','mas','ou','e','ao','aos',
  'eh','esta','este','estes','estas','isso','aqui','la','nao','sim','ja','so','mais','menos',
  'muito','pouco','bem','mal','ainda','agora','quando','como','onde','ser','foi','era','sao',
  'tem','ter','vai','vou','pode','ira','sera','esta','estao','estou','tudo','todos','toda',
  // Inglês — artigos, preposições, auxiliares
  'the','an','of','to','in','for','on','with','at','by','from','up','about','into',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','not','no','or','and','but','if','as',
  'it','its','that','this','they','them','their','there','then','than','so','all',
  'also','just','more','can','we','you','he','she','our','his','her','new',
  // Palavras de formato/editorial
  'estreia','estreias','estreou','lancamento','lancamentos','lanca','lancou',
  'anuncia','anuncio','confirma','confirmado','confirmada','revelado','revelada',
  'revela','veja','assista','saiba','novo','nova','novos','novas','primeiro','primeira',
  'ultimas','ultima','ultimo','noticias','exclusivo','exclusiva','especial',
  'serie','series','filme','filmes','animacao','documentario','temporada',
  'episodio','episodios','parte','capitulo','trailer','review','critica',
  // Plataformas de streaming (evita que "netflix" vire o único token relevante)
  'netflix','disney','hbo','max','prime','amazon','apple','hulu','paramount',
  'peacock','globo','globoplay','youtube','twitch','spotify',
])

const TOKEN_EQUIVALENTS = [
  { canonical: 'redesign', variants: ['redesign', 'redesenho', 'visual', 'design', 'look', 'aparencia', 'appearance'] },
  { canonical: 'feedback', variants: ['critica', 'criticas', 'feedback', 'pedido', 'pedidos'] },
]

function normalizeText(s) {
  let normalized = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const { canonical, variants } of TOKEN_EQUIVALENTS) {
    for (const variant of variants) {
      normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'g'), canonical)
    }
  }

  return normalized
}

function tokenize(s) {
  return normalizeText(s).split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

// Jaccard: intersection / union — mais estável que overlap/min
function jaccardScore(a, b) {
  const aSet = new Set(tokenize(a))
  const bSet = new Set(tokenize(b))
  if (aSet.size === 0 && bSet.size === 0) return 1
  if (aSet.size === 0 || bSet.size === 0) return 0
  let intersection = 0
  for (const w of aSet) if (bSet.has(w)) intersection++
  const union = aSet.size + bSet.size - intersection
  return intersection / union
}

function textOverlapScore(a, b) {
  return jaccardScore(a, b)
}

// Tokens "fortes": len >= 5 e não-stopword — nomes próprios, títulos, termos técnicos
function strongTokenize(s) {
  return normalizeText(s).split(' ').filter(w => w.length >= 5 && !STOPWORDS.has(w))
}

// Retorna os tokens fortes compartilhados (usados para âncora e auditoria)
function strongIntersection(a, b) {
  const aSet = new Set(strongTokenize(a))
  const bSet = new Set(strongTokenize(b))
  const common = []
  for (const w of aSet) if (bSet.has(w)) common.push(w)
  return common
}

// Remove parâmetros de rastreamento e fragmento para comparar/salvar URLs canonicamente
const TRACKING_PARAMS = [
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id',
  'fbclid','gclid','msclkid','twclid','dclid','zanpid','rdid',
]
function canonicalizeUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    TRACKING_PARAMS.forEach(p => u.searchParams.delete(p))
    return u.toString()
  } catch {
    return url
  }
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
    return items.length === 1 ? [[items[0].id]] : []
  }

  const mappedClusters = clusterDeterministicItems(items, {
    similarityThreshold: 0.3,
    minStrongTokens: 3,
  })

  if (mappedClusters.length === 0) {
    console.warn(`[${topic}] ⚠️  Nenhum cluster válido, fallback`)
    return items.map((item) => [item.id])
  }

  console.log(`[${topic}] ✓ Clustering local: ${items.length} itens → ${mappedClusters.length} clusters`)
  return mappedClusters
}

// ═══════════════════════════════════════════════════════════════
// FASE 2: Processamento de Conteúdo (Geração de Artigos)
// ═══════════════════════════════════════════════════════════════
export async function processTopicWithGemini(topic, results, existingTitles, clusters, rawItemsMap) {
  if (!results.length || !clusters.length) return []

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const allParsedItems = [] // Array de { item, clusterSourceIds }
  const allProcessedClusterSourceIds = new Set() // Rastreia TODOS os clusters processados com sucesso
  const quarantinedClusterSourceIds = new Set() // Clusters inválidos que não devem voltar para retry automático

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

O cluster já passou por validação local antes de chegar aqui. Se ainda parecer inconsistente, retorne [].

**2. CRITÉRIOS DE NOTICIABILIDADE (FILTRO DE QUALIDADE):**
- **GERAR ARTIGO:** Lançamentos de produtos/hardware (Galaxy S26, PS5, Switch 2), trailers, anúncios de filmes/séries, atualizações de games (patch notes), mudanças de preços de mercado (gasolina, dólar, ações), contratações relevantes e colaborações (ex: Ed Sheeran x Pokémon).
- **IGNORAR (Retornar []):**
  - Promoções, descontos, black friday, cupons, ofertas relâmpago
  - Listas puras de cupons sem contexto de lançamento
  - Anúncios genéricos de "compre agora" ou "economize X%" ou "madrugada"
  - Palavras-chave PROIBIDAS: "promoção", "desconto", "oferta", "cupom", "black friday", "% off", "économize", "madrugada", "deal"
  - Se a notícia é APENAS sobre preço/desconto de um produto, IGNORAR completamente.
- **NA DÚVIDA:** Gere o artigo. O Lophos prefere informar ao silenciar.

**INSTRUÇÕES DE PROCESSAMENTO:**
- Regra de ouro: múltiplas fontes sobre o mesmo fato viram um único artigo com todas as fontes.
- Fidelidade brutal: todo número, nome, valor ou mudança deve vir diretamente das fontes.
- Citações: reproduza ou parafraseie fielmente, nunca resuma demais.
- Proibido: "fãs estão animados", "diversos itens", "muitos usuários".

**Tom:**
Direto, jornalístico, sem floreios. Comece pelo fato mais impactante.

**IDIOMA (OBRIGATÓRIO):**
- Escreva TODO o conteúdo em português do Brasil.
- "title", "summary", "sections.heading" e "sections.body" devem estar em português do Brasil, mesmo quando todas as fontes estiverem em inglês.
- Pode manter nomes próprios, marcas, franquias e títulos oficiais sem traduzir.
- Não copie manchetes em inglês; traduza/adapte a manchete para português do Brasil preservando o sentido factual.

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
        clusterSourceIds.forEach(id => {
          allProcessedClusterSourceIds.add(id)
          quarantinedClusterSourceIds.add(id)
        })
      } else {
        try {
          const jsonStr = text.substring(firstBracket, lastBracket + 1)
          const parsed = JSON.parse(jsonStr)

          // ✅ Marca este cluster como processado com sucesso (mesmo que 0 artigos)
          clusterSourceIds.forEach(id => allProcessedClusterSourceIds.add(id))

          // ✅ ISOLAMENTO: Vincula cada item com seu cluster source_ids E clusterItems
          parsed.forEach(item => {
            allParsedItems.push({ item, clusterSourceIds, clusterItems })
          })
          console.log(`[${topic}] Cluster ${clusterNum}: ${parsed.length} artigo(s) gerado(s) ✓`)
        } catch (parseErr) {
          console.warn(`[${topic}] Cluster ${clusterNum}: Parse JSON falhou: ${parseErr.message}`)
          clusterSourceIds.forEach(id => {
            allProcessedClusterSourceIds.add(id)
            quarantinedClusterSourceIds.add(id)
          })
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

  for (const { item, clusterSourceIds, clusterItems } of allParsedItems) {
    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) {
      console.warn(`[${topic}] ⚠️  DESCARTE: sourceIndexes ausente/inválido em artigo gerado`)
      continue
    }

    // ✅ ISOLAMENTO DE LOOP: Variáveis locais resetadas a cada iteração
    const sourceIndexes = item.sourceIndexes.map(n => n - 1) // Converter 1-base → 0-based

    // 🔧 LÓGICA ROBUSTA: Mapeamento com fallback inteligente
    let articleSourceIds = []

    if (clusterSourceIds.length === 1) {
      // ✅ SINGLE SOURCE: Força usar esse UUID, ignora índice da IA
      articleSourceIds = [clusterSourceIds[0]]
      console.log(`[${topic}] 🔗 Single source: forçando ${clusterSourceIds[0]}`)
    } else {
      // ✅ MULTI-SOURCE: Valida índices e mapeia corretamente
      articleSourceIds = sourceIndexes
        .filter(idx => idx >= 0 && idx < clusterSourceIds.length)
        .map(idx => clusterSourceIds[idx])
        .filter(Boolean)

      // 🐛 DEBUG LOG: Mostrar mismatch se houver
      if (articleSourceIds.length !== sourceIndexes.length) {
        const iaRetornou = item.sourceIndexes.join(', ')
        const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
        console.warn(`[${topic}] 🔍 DEBUG INDEX MISMATCH:`)
        console.warn(`   IA retornou sourceIndexes: [${iaRetornou}]`)
        console.warn(`   Cluster tem ${clusterSourceIds.length} fontes (UUIDs: ${clusterUUIDs}...)`)
        console.warn(`   Artigo: "${item.title?.slice(0, 50)}"`)
        console.warn(`   Mapeados: ${articleSourceIds.length}/${sourceIndexes.length} indices válidos`)
      }
    }

    if (articleSourceIds.length === 0) {
      const iaRetornou = item.sourceIndexes.join(', ')
      const clusterUUIDs = clusterSourceIds.map(id => id.substring(0, 8)).join(', ')
      console.error(`[${topic}] ❌ ERRO: Nenhum source_id válido mapeado!`)
      console.error(`   Artigo: "${item.title?.slice(0, 50)}"`)
      console.error(`   IA retornou sourceIndexes: [${iaRetornou}]`)
      console.error(`   Cluster tem ${clusterSourceIds.length} fontes: [${clusterUUIDs}...]`)
      console.error(`   Causa provável: índices fora do range ou mismatch`)
      continue
    }

    const articleRawItems = articleSourceIds
      .map(uuid => rawItemsMap.get(uuid))
      .filter(Boolean)

    // ✅ EXTRAÇÃO DE IMAGEM/VÍDEO: usar raw_items reais do artigo
    let imageUrl = null
    let imageSource = null
    let imageSourceDomain = null
    let videoUrl = null

    // Fase 1: Tenta pegar imagem e vídeo já extraídos no RSS
    for (const rawItem of articleRawItems) {
      const candidate = rawItem?.image_url
      if (candidate && !isLazyLoadImage(candidate)) {
        imageUrl = candidate
        imageSource = rawItem.url
        imageSourceDomain = new URL(imageSource).hostname.replace('www.', '')
        break
      }
    }

    for (const rawItem of articleRawItems) {
      if (rawItem?.video_url) {
        videoUrl = rawItem.video_url
        break
      }
    }

    // Fase 2: Fallback - busca og:image das URLs se não encontrou no RSS
    if (!imageUrl) {
      for (const rawItem of articleRawItems) {
        const sourceUrl = rawItem?.url
        if (sourceUrl) {
          imageUrl = await fetchOgImage(sourceUrl)
          if (imageUrl) {
            imageSourceDomain = new URL(sourceUrl).hostname.replace('www.', '')
            console.log(`[${topic}] 🖼️  og:image encontrada de ${imageSourceDomain}`)
            break
          }
        }
      }
    }

    // Fase 3: FAILSAFE - placeholder se nada funcionar
    if (!imageUrl) {
      imageUrl = `https://via.placeholder.com/1200x630?text=${encodeURIComponent(item.title?.slice(0, 30) || 'Lophos News')}`
      console.warn(`[${topic}] 📸 Placeholder — ${item.title?.slice(0, 50)}`)
    } else if (imageSourceDomain) {
      console.log(`[${topic}] 🖼️  Imagem de ${imageSourceDomain}`)
    }

    // ✅ CONSTRUIR SOURCES: Usar articleSourceIds (UUIDs validados) para buscar fontes reais
    const sources = articleSourceIds
      .map(uuid => {
        const rawItem = rawItemsMap.get(uuid)
        if (!rawItem?.url) {
          console.warn(`[${topic}] ⚠️  UUID ${uuid.substring(0, 8)}... sem URL no raw_items`)
          return null
        }
        const cleanUrl = canonicalizeUrl(rawItem.url)
        return {
          name: new URL(cleanUrl).hostname.replace('www.', ''),
          url: cleanUrl,
          favicon: `https://www.google.com/s2/favicons?domain=${cleanUrl}&sz=32`,
        }
      })
      .filter(Boolean) // Remove nulls

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
      video_url: videoUrl,
      published_at: now,
      cached_at: now,
      matched_topics: keywords,
      source_ids: articleSourceIds, // ✅ APENAS os IDs deste artigo específico
    })
  }

  return {
    newsItems,
    success: true,
    processedClusterSourceIds: Array.from(allProcessedClusterSourceIds),
    quarantinedClusterSourceIds: Array.from(quarantinedClusterSourceIds),
  }
}

async function processTopic(topic, acceptedItems, existingTitles, clusters, rawItemsMap, rejectedRawIds = []) {
  const results = (acceptedItems || []).map((item) => ({
    url: item.url,
    title: item.title,
    content: item.content || '',
    image: item.image_url,
    video: item.video_url,
  }))

  if (!results.length || !clusters.length) {
    return { newsItems: [], success: true, rejectedRawIds }
  }

  let parsed
  try {
    parsed = await processTopicWithGemini(topic, results, existingTitles, clusters, rawItemsMap)
  } catch (err) {
    // Gemini error (503, 429, etc) — NÃO marcar como processado
    const statusCode = err.status || err.message.match(/\d{3}/)
    console.error(`[${topic}] ⚠️  Erro na IA (${statusCode}): ${err.message}. Mantendo items como não-processados para retry.`)
    return { newsItems: [], success: false, geminiError: true, rejectedRawIds }
  }

  return { ...parsed, rejectedRawIds }
}

async function main() {
  const rawLookbackSince = new Date(Date.now() - PROCESS_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

  // Get all distinct topics with unprocessed items
  const { data: topicRows, error: topicError } = await db
    .from('raw_items')
    .select('topic')
    .eq('processed', false)
    .gte('pub_date', rawLookbackSince)

  if (topicError) throw new Error('DB error: ' + topicError.message)
  if (!topicRows?.length) { console.log('No unprocessed items found.'); return }

  const topics = [...new Set(topicRows.map(r => r.topic).filter(Boolean))]
  console.log(`\n🧹 MODO FAXINA — Lophos Cleanup Mode`)
  console.log(`RPM: 4K ilimitado | Items/tópico: ${BATCH_SIZE} | Delay: ${DELAY_BETWEEN_TOPICS_MS}ms | Relevância: 0.10+`)
  console.log(`Janela de processamento: últimas ${PROCESS_LOOKBACK_HOURS}h (${rawLookbackSince})`)
  console.log(`Backlog estimado: 651 notícias | Target: 1 rodada`)
  console.log(`Topics to process: ${topics.join(', ')}\n`)

  // Fetch existing articles (últimas 72h — janela ampliada para dedup mais robusto)
  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  const { data: globalExisting } = await db
    .from('articles')
    .select('id, title, summary, sources, keywords, matched_topics, image_url, video_url')
    .gte('published_at', since72h)
    .order('published_at', { ascending: false })
    .limit(300)

  const allProcessedArticles = (globalExisting || []).map(r => ({
    id: r.id,
    title: r.title,
    summary: r.summary || '',
    sources: r.sources || [],
    keywords: r.keywords || [],
    matched_topics: r.matched_topics || [],
    image_url: r.image_url || null,
    video_url: r.video_url || null,
  }))
  console.log(`Artigos existentes (últimas 72h): ${allProcessedArticles.length}\n`)

  const DEBUG_DEDUP = process.env.DEBUG_DEDUP === '1'
  let totalGenerated = 0
  let totalMerged = 0
  let totalSaved = 0
  let hadTopicError = false

  for (let ti = 0; ti < topicPayloads.length; ti++) {
    const topicPayload = topicPayloads[ti]
    const topic = topicPayload.topic
    const acceptedItems = topicPayload.acceptedItems || []
    const clusters = topicPayload.clusters || []
    const rejectedRawIds = uniqueIds(topicPayload.rejectedRawIds || [])

    if (!acceptedItems.length && !rejectedRawIds.length) {
      continue
    }

    if (!acceptedItems.length || !clusters.length) {
      if (rejectedRawIds.length > 0) {
        const { error: rejectedMarkError } = await db
          .from('raw_items')
          .update({ processed: true })
          .in('id', rejectedRawIds)

        if (rejectedMarkError) {
          console.warn(`[${topic}] Could not mark rejected items as processed: ${rejectedMarkError.message}`)
        } else {
          console.log(`[${topic}] ✓ ${rejectedRawIds.length} rejected items marcados como processados`)
        }
      }
      continue
    }

    try {
      console.log(`[${topic}] ${acceptedItems.length} items → Gemini only (${clusters.length} clusters)`)

      const rawItemsMap = new Map(acceptedItems.map((item) => [item.id, item]))
      const { newsItems, geminiError, processedClusterSourceIds, rejectedRawIds: localRejectedRawIds = [] } = await processTopic(
        topic,
        acceptedItems,
        allProcessedArticles.map((a) => a.title),
        clusters,
        rawItemsMap,
        rejectedRawIds
      )

      const dedupedItems = []
      const successfullyProcessedRawIds = new Set([
        ...rejectedRawIds,
        ...localRejectedRawIds,
        ...(processedClusterSourceIds || []),
      ])

      if (geminiError) {
        hadTopicError = true
        if (successfullyProcessedRawIds.size > 0) {
          await db.from('raw_items')
            .update({ processed: true })
            .in('id', Array.from(successfullyProcessedRawIds))
        }
        if (ti < topicPayloads.length - 1) {
          console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_TOPICS_MS))
        }
        continue
      }

      for (const item of newsItems) {
        const contentDecision = shouldRejectContent({
          title: item.title,
          summary: item.summary,
          sections: item.sections || [],
          urls: Array.isArray(item.sources) ? item.sources.map(source => source?.url).filter(Boolean) : [],
          sourceNames: Array.isArray(item.sources) ? item.sources.map(source => source?.name).filter(Boolean) : [],
        })
        if (contentDecision.reject) {
          console.log(`[${topic}] ⛔ article filtered (${contentDecision.reason}): ${item.title?.slice(0, 90)}`)
          if (Array.isArray(item.source_ids)) {
            item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
          }
          continue
        }

        const itemText = `${item.title || ''} ${item.summary || ''}`

        let bestMatch = null
        let bestScore = 0
        let bestStrongCommon = []
        let auditScore = 0
        let auditReason = ''
        let auditTitle = ''

        for (const existing of allProcessedArticles) {
          const existingText = `${existing.title || ''} ${existing.summary || ''}`
          const score = textOverlapScore(itemText, existingText)

          if (score < SIMILARITY_THRESHOLD) {
            if (score > auditScore) {
              auditScore = score
              auditReason = `below-threshold(${score.toFixed(3)}<${SIMILARITY_THRESHOLD})`
              auditTitle = existing.title
            }
            continue
          }

          const strongCommon = strongIntersection(itemText, existingText)
          if (strongCommon.length < MIN_STRONG_TOKENS) {
            if (score > auditScore) {
              auditScore = score
              auditReason = `anchor-miss([${strongCommon.join(',')}] ${strongCommon.length}/${MIN_STRONG_TOKENS})`
              auditTitle = existing.title
            }
            if (DEBUG_DEDUP) {
              console.log(`  [DEDUP] ⚓ ANCHOR-MISS score=${score.toFixed(3)} tokens=[${strongCommon.join(',')}](${strongCommon.length}<${MIN_STRONG_TOKENS}) existing="${existing.title?.slice(0, 55)}"`)
            }
            continue
          }

          if (score > bestScore) {
            bestScore = score
            bestMatch = existing
            bestStrongCommon = strongCommon
          }
        }

        const match = bestMatch

        if (match) {
          console.log(`  [DEDUP] 🔀 MERGE score=${bestScore.toFixed(3)} anchor=[${bestStrongCommon.join(',')}] id=${match.id?.slice(0, 8)} | existing="${match.title?.slice(0, 55)}" → new="${item.title?.slice(0, 55)}"`)
          const existingUrls = new Set((match.sources || []).map(s => canonicalizeUrl(s.url)))
          const newSources = item.sources.filter(s => !existingUrls.has(canonicalizeUrl(s.url)))
          const mergedKeywords = [...new Set([...match.keywords, ...(item.keywords || [])])]
          const mergedMatchedTopics = [...new Set([...match.matched_topics, ...(item.matched_topics || [])])]
          const shouldBackfillImage = !match.image_url && !!item.image_url
          const shouldBackfillVideo = !match.video_url && !!item.video_url

          const keywordsChanged = mergedKeywords.length > match.keywords.length
          const topicsChanged = mergedMatchedTopics.length > match.matched_topics.length

          if (newSources.length > 0 || keywordsChanged || topicsChanged || shouldBackfillImage || shouldBackfillVideo) {
            const mergedSources = [...match.sources, ...newSources]
            const updatePayload = {
              sources: mergedSources,
              keywords: mergedKeywords,
              matched_topics: mergedMatchedTopics,
            }
            if (shouldBackfillImage) updatePayload.image_url = item.image_url
            if (shouldBackfillVideo) updatePayload.video_url = item.video_url
            const { error: mergeError } = await db
              .from('articles')
              .update(updatePayload)
              .eq('id', match.id)

            if (mergeError) {
              console.error(`[${topic}] ⚠️  Merge error: ${mergeError.message}. Item não será marcado como processado.`)
            } else {
              match.sources = mergedSources
              match.keywords = mergedKeywords
              match.matched_topics = mergedMatchedTopics
              if (shouldBackfillImage) match.image_url = item.image_url
              if (shouldBackfillVideo) match.video_url = item.video_url
              totalMerged++
              if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
                item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
              } else {
                console.warn(`[${topic}] ⚠️  source_ids inválido no merge: ${typeof item.source_ids}. Artigo salvo mas mapeamento skipped para revisão.`)
              }
            }
          } else {
            if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
              item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
            } else {
              console.warn(`[${topic}] ⚠️  source_ids inválido (sem mudanças): ${typeof item.source_ids}. Artigo salvo mas mapeamento skipped para revisão.`)
            }
          }
        } else {
          if (DEBUG_DEDUP) {
            const auditMsg = auditScore > 0
              ? `best-rejected=${auditScore.toFixed(3)} reason=${auditReason} candidate="${auditTitle?.slice(0, 50)}"`
              : 'no-candidates'
            console.log(`  [DEDUP] ✨ NEW "${item.title?.slice(0, 60)}" | ${auditMsg}`)
          }
          dedupedItems.push(item)
        }
      }

      const validArticles = []
      const invalidArticles = []

      for (const item of dedupedItems) {
        if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
          console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com ZERO fontes! "${item.title?.slice(0, 50)}"`)
          console.error(`   source_ids: ${item.source_ids}`)
          console.error(`   sources: ${item.sources?.length || 0} fontes`)
          invalidArticles.push(item)
          continue
        }

        if (!Array.isArray(item.sources) || item.sources.length === 0) {
          console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com array sources vazio! "${item.title?.slice(0, 50)}"`)
          console.error(`   source_ids: ${item.source_ids.join(', ')}`)
          invalidArticles.push(item)
          continue
        }

        validArticles.push(item)
      }

      if (validArticles.length > 0) {
        console.log(`[${topic}] 📦 Gravando no BD: ${validArticles.length} artigos`)
        validArticles.forEach((item, i) => {
          const sourceIdStr = item.source_ids.map(id => id.substring(0, 8)).join(', ')
          console.log(`   ${i + 1}. "${item.title?.slice(0, 60)}" | Fontes: [${sourceIdStr}...]`)
        })

        const { error: saveError } = await db.from('articles').upsert(validArticles, { onConflict: 'id' })

        if (saveError) {
          console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${validArticles.length} items não serão marcados como processados.`)
        } else {
          console.log(`[${topic}] ✅ ${validArticles.length} artigos salvos com sucesso`)
          totalSaved += validArticles.length

          for (const item of validArticles) {
            allProcessedArticles.push({
              id: item.id,
              title: item.title,
              summary: item.summary || '',
              sources: item.sources,
              keywords: item.keywords || [],
              matched_topics: item.matched_topics || [],
            })
            item.source_ids.forEach(id => successfullyProcessedRawIds.add(id))
          }
        }
      }

      if (invalidArticles.length > 0) {
        console.warn(`[${topic}] ⚠️  ${invalidArticles.length} artigos rejeitados (zero fontes)`)
      }

      totalGenerated += dedupedItems.length

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
        console.warn(`[${topic}] ⚠️  Nenhum item marcado como processado (verifique source_ids na resposta da IA ou clustering)`)
      }

      if (ti < topicPayloads.length - 1) {
        console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_TOPICS_MS))
      }
    } catch (err) {
      hadTopicError = true
      console.error(`[${topic}] ⚠️  Erro crítico: ${err.message}. Items não serão marcados como processados.`)
    }
  }

  const finalStatus = hadTopicError ? 'failed' : 'processed'
  const { error: statusUpdateError } = await db
    .from('news_cluster_runs')
    .update({
      status: finalStatus,
      processed_at: new Date().toISOString(),
      error_message: hadTopicError ? 'One or more topics failed during Gemini processing' : null,
    })
    .eq('id', clusterRun.id)

  if (statusUpdateError) {
    console.warn(`Could not update cluster run status: ${statusUpdateError.message}`)
  } else {
    console.log(`Cluster run ${clusterRun.id} marked as ${finalStatus}.`)
  }

  const totalProcessed = totalSaved + totalMerged
  const backlogReduction = totalProcessed > 0 ? `651 → ~${Math.max(0, 651 - totalProcessed)}` : 'N/A'
  console.log(`\n✨ FAXINA CONCLUÍDA!`)
  console.log(`Topics: ${topicPayloads.length} | Artigos gerados: ${totalGenerated} | Salvos: ${totalSaved} | Merges: ${totalMerged}`)
  console.log(`Backlog reduzido: ${backlogReduction} notícias`)
  console.log(`Total processado com sucesso: ${totalProcessed} notícias 🎉\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
