/**
 * Shared Mistral synthesis core.
 *
 * Imported by the Mistral runner. This file should contain the article
 * generation logic, but not the cron orchestration.
 */

import { randomUUID } from 'crypto'
import { buildNewsSourceFromItem } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const MISTRAL_API_URL = (process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1/chat/completions').replace(/\/+$/, '')
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest'
const MISTRAL_TIMEOUT_MS = Number(process.env.MISTRAL_TIMEOUT_MS || 300000)
const MISTRAL_RETRY_BASE_DELAY_MS = Number(process.env.MISTRAL_RETRY_BASE_DELAY_MS || 2000)
const MISTRAL_CLUSTER_DELAY_MS = Number(process.env.MISTRAL_CLUSTER_DELAY_MS || 500)

const CONTENT_CHARS = 2000

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

function isLazyLoadImage(url) {
  if (!url) return false
  return [
    'lazyload',
    'lazy-load',
    'placeholder',
    'blank.gif',
    'spacer.gif',
    'fallback.gif',
    'favicon',
    '/favicon',
    'apple-touch-icon',
    'logo-icon',
  ].some((pattern) => url.toLowerCase().includes(pattern))
}

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

    if (!imageUrl) {
      match = html.match(/<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl) {
      match = html.match(/<picture[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl) {
      match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
      imageUrl = match?.[1]
    }

    if (!imageUrl || isLazyLoadImage(imageUrl)) return null

    try {
      return new URL(imageUrl, url).href
    } catch {
      return imageUrl
    }
  } catch {
    return null
  }
}

function shouldRejectContent({ title, summary = '', sections = [], urls = [], sourceNames = [], rawTexts = [] }) {
  const sectionText = Array.isArray(sections)
    ? sections.map((section) => `${section?.heading || ''} ${section?.body || ''}`).join(' \n ')
    : ''

  const haystack = [title, summary, sectionText, ...urls, ...sourceNames, ...rawTexts]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()

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

function extractMessageText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return ''
        if (typeof part === 'string') return part
        if (typeof part.text === 'string') return part.text
        return ''
      })
      .join('')
  }
  return ''
}

async function generateWithMistral(prompt) {
  if (!MISTRAL_API_KEY) {
    throw new Error('Missing environment variable: MISTRAL_API_KEY')
  }

  const maxAttempts = 3
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MISTRAL_TIMEOUT_MS)

    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: {
            type: 'json_object',
          },
          temperature: 0.2,
          max_tokens: 4096,
          stream: false,
          safe_prompt: false,
        }),
        signal: controller.signal,
      })

      const rawText = await response.text()
      if (!response.ok) {
        const error = new Error(`Mistral API error (${response.status}): ${rawText}`)
        error.status = response.status

        if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
          lastError = error
          const backoffMs = MISTRAL_RETRY_BASE_DELAY_MS * attempt
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
          continue
        }

        throw error
      }

      const data = JSON.parse(rawText)
      const text = extractMessageText(data?.choices?.[0]?.message?.content)

      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Mistral returned an empty response.')
      }

      return text
    } catch (err) {
      lastError = err
      if ((err?.name === 'AbortError' || err?.status === 429 || err?.status === 503) && attempt < maxAttempts) {
        const backoffMs = MISTRAL_RETRY_BASE_DELAY_MS * attempt
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        continue
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError || new Error('Mistral request failed.')
}

export async function processTopicWithMistral(topic, results, existingTitles, clusters, rawItemsMap) {
  if (!results.length || !clusters.length) return []

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const allParsedItems = []
  const allProcessedClusterSourceIds = new Set()
  const quarantinedClusterSourceIds = new Set()

  for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
    const clusterSourceIds = clusters[clusterIdx]
    const clusterNum = clusterIdx + 1

    const clusterItems = clusterSourceIds
      .map((sourceId) => {
        const rawItem = rawItemsMap.get(sourceId)
        return rawItem ? results.find((r) => r.url === rawItem.url) : null
      })
      .filter(Boolean)

    console.log(`[${topic}] Cluster ${clusterNum}/${clusters.length}: Processando ${clusterItems.length} fontes relacionadas (source_ids: ${clusterSourceIds.join(',')})...`)

    const context = clusterItems
      .map((r, i) => {
        const hostname = new URL(r.url).hostname.replace('www.', '')
        const meta = [
          r.sourceName ? `fonte: ${r.sourceName}` : null,
          r.pubDate ? `data: ${r.pubDate}` : null,
          r.summary ? `resumo: ${r.summary}` : null,
        ].filter(Boolean).join(' | ')

        return `[${i + 1}] ${hostname} - "${r.title}"${meta ? `\n${meta}` : ''}\n${(r.content || '').slice(0, CONTENT_CHARS)}`
      })
      .join('\n\n')

    const existingContext = existingTitles.length > 0
      ? `\nNOTICIAS JA PUBLICADAS (NAO repita):\n${existingTitles.map((t) => `- ${t}`).join('\n')}\n`
      : ''

    const prompt = `Voce e o Curador-Chefe do Lophos, o portal de noticias lider em 2026.
Sua missao: transformar um cluster de fontes relacionadas no artigo mais denso, factual e relevante possivel.

**1. REGRAS ANTI-ALUCINACAO (PRIORIDADE MAXIMA):**
- Utilize apenas informacoes explicitas nas fontes fornecidas.
- Proibido inferir, assumir ou completar dados ("e provavel que", "fas sugerem").
- Se um dado nao estiver claramente escrito nas fontes, nao inclua.
- Numeros, datas, nomes e especificacoes devem ser literais. Se a fonte diz "aumento significativo", NAO transforme em "15%".
- Tom seco, direto e jornalistico. Sem introducoes poeticas ou floreios.

O cluster ja passou por validacao local antes de chegar aqui. Nesta etapa, nunca retorne []. Sempre gere exatamente 1 artigo JSON com base nas fontes do cluster.

**2. CRITERIOS DE NOTICIABILIDADE (FILTRO DE QUALIDADE):**
- **GERAR ARTIGO:** Lancamentos de produtos/hardware (Galaxy S26, PS5, Switch 2), trailers, anuncios de filmes/series, atualizacoes de games (patch notes), mudancas de precos de mercado (gasolina, dolar, acoes), contratacoes relevantes e colaboracoes (ex: Ed Sheeran x Pokemon).
- **IGNORAR (em tese, para clusters que escapem do preflight):**
  - Promocoes, descontos, black friday, cupons, ofertas relampago
  - Listas puras de cupons sem contexto de lancamento
  - Anuncios genericos de "compre agora" ou "economize X%" ou "madrugada"
  - Palavras-chave PROIBIDAS: "promocao", "desconto", "oferta", "cupom", "black friday", "% off", "economize", "madrugada", "deal"
  - Se a noticia e APENAS sobre preco/desconto de um produto, escreva o artigo mais enxuto possivel sem inventar detalhes; nao retorne [].
- **NA DUVIDA:** Gere o artigo. Prefira um artigo curto e factual a retornar [].
- Nao retorne [] apenas porque ha uma unica fonte; se houver fato jornalistico claro, gere.

**INSTRUCOES DE PROCESSAMENTO:**
- Regra de ouro: multiplas fontes sobre o mesmo fato viram um unico artigo com todas as fontes.
- Fidelidade brutal: todo numero, nome, valor ou mudanca deve vir diretamente das fontes.
- Citacoes: reproduza ou parafraseie fielmente, nunca resuma demais.
- Proibido: "fas estao animados", "diversos itens", "muitos usuarios".

**Tom:**
Direto, jornalistico, sem floreios. Comece pelo fato mais impactante.

**IDIOMA (OBRIGATORIO):**
- Escreva TODO o conteudo em portugues do Brasil.
- "title", "summary", "sections.heading" e "sections.body" devem estar em portugues do Brasil, mesmo quando todas as fontes estiverem em ingles.
- Pode manter nomes proprios, marcas, franquias e titulos oficiais sem traduzir.
- Nao copie manchetes em ingles; traduza/adapte a manchete para portugues do Brasil preservando o sentido factual.

**RESPOSTA:**
Retorne EXCLUSIVAMENTE um array JSON com UM artigo (ou [] se vazio). Sem markdown, comentarios ou texto extra.

[
  {
    "title": "manchete forte, clara, com termos da fonte",
    "summary": "2-4 frases carregadas de dados",
    "sections": [
      {
        "heading": "secao 1 (so crie se houver informacao suficiente)",
        "body": "conteudo denso com numeros e dados"
      }
    ],
    "sourceIndexes": [1, 3, 5],
    "keywords": ["termo1", "termo2", "termo3"],
    "relevance": 0.95
  }
]

**REGRAS FINAIS:**
- Retorne EXCLUSIVAMENTE o array JSON.
- Se as fontes forem lixo (cupons, promocoes vazias etc.), gere o artigo mais curto e factual possivel, sem inventar dados.
- Caso contrario, gere o melhor artigo possivel, mesmo que a cobertura esteja enxuta.
- Nunca adicione markdown, explicacao ou texto fora do JSON.
- sourceIndexes: obrigatorio, so as fontes realmente usadas
- keywords: 5 a 15 termos em minusculo, separados por virgula, otimizados para SEO
- relevance: float de 0.0 a 1.0 (seja generoso com hard news e cultura pop)

**CONTEXTO:**
- Data: ${today}
- Topico: "${topic}"
- Artigos ja publicados: ${existingContext}
- Cluster ${clusterNum}/${clusters.length}: ${clusterItems.length} fontes RELACIONADAS com ate 2000 chars cada

FONTES:
${context}`

    try {
      const text = await generateWithMistral(prompt)

      try {
        const parsedRaw = JSON.parse(text)
        const parsed = Array.isArray(parsedRaw) ? parsedRaw : [parsedRaw]

        if (parsed.length === 0) {
          throw new Error('Mistral returned an empty article list.')
        }

        clusterSourceIds.forEach((id) => allProcessedClusterSourceIds.add(id))
        parsed.forEach((item) => {
          allParsedItems.push({ item, clusterSourceIds, clusterItems })
        })
        console.log(`[${topic}] Cluster ${clusterNum}: ${parsed.length} artigo(s) gerado(s) OK`)
      } catch (parseErr) {
        console.warn(`[${topic}] Cluster ${clusterNum}: Parse JSON falhou: ${parseErr.message}`)
        clusterSourceIds.forEach((id) => {
          allProcessedClusterSourceIds.add(id)
          quarantinedClusterSourceIds.add(id)
        })
      }
    } catch (err) {
      const statusCode = err.status || err.message.match(/\d{3}/)
      console.error(`[${topic}] ERROR IA (cluster ${clusterNum}, ${statusCode}): ${err.message}. Mantendo items como nao-processados para retry.`)
      throw err
    } finally {
      if (clusterIdx < clusters.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, MISTRAL_CLUSTER_DELAY_MS))
      }
    }
  }

  const now = new Date().toISOString()
  const newsItems = []

  for (const { item, clusterSourceIds, clusterItems } of allParsedItems) {

    if (!item.sourceIndexes || !Array.isArray(item.sourceIndexes) || item.sourceIndexes.length === 0) {
      if (clusterSourceIds.length === 1) {
        item.sourceIndexes = [1]
      } else {
        console.warn(`[${topic}] ⚠️  DESCARTE: sourceIndexes ausente/invalido em artigo gerado`)
        continue
      }
    }

    const sourceIndexes = item.sourceIndexes.map((n) => n - 1)
    let articleSourceIds = []

    if (clusterSourceIds.length === 1) {
      articleSourceIds = [clusterSourceIds[0]]
      console.log(`[${topic}] 🔗 Single source: forcando ${clusterSourceIds[0]}`)
    } else {
      articleSourceIds = sourceIndexes
        .filter((idx) => idx >= 0 && idx < clusterSourceIds.length)
        .map((idx) => clusterSourceIds[idx])
        .filter(Boolean)

      if (articleSourceIds.length !== sourceIndexes.length) {
        const iaRetornou = item.sourceIndexes.join(', ')
        const clusterUUIDs = clusterSourceIds.map((id) => id.substring(0, 8)).join(', ')
        console.warn(`[${topic}] 🔍 DEBUG INDEX MISMATCH:`)
        console.warn(`   IA retornou sourceIndexes: [${iaRetornou}]`)
        console.warn(`   Cluster tem ${clusterSourceIds.length} fontes (UUIDs: ${clusterUUIDs}...)`)
        console.warn(`   Artigo: "${item.title?.slice(0, 50)}"`)
        console.warn(`   Mapeados: ${articleSourceIds.length}/${sourceIndexes.length} indices validos`)
      }
    }

    if (articleSourceIds.length === 0) {
      const iaRetornou = item.sourceIndexes.join(', ')
      const clusterUUIDs = clusterSourceIds.map((id) => id.substring(0, 8)).join(', ')
      console.error(`[${topic}] ❌ ERRO: Nenhum source_id valido mapeado!`)
      console.error(`   Artigo: "${item.title?.slice(0, 50)}"`)
      console.error(`   IA retornou sourceIndexes: [${iaRetornou}]`)
      console.error(`   Cluster tem ${clusterSourceIds.length} fontes: [${clusterUUIDs}...]`)
      console.error(`   Causa provavel: indices fora do range ou mismatch`)
      continue
    }

    const articleRawItems = articleSourceIds
      .map((uuid) => rawItemsMap.get(uuid))
      .filter(Boolean)

    let imageUrl = null
    let imageSourceDomain = null
    let videoUrl = null

    for (const rawItem of articleRawItems) {
      const candidate = rawItem?.image_url
      if (candidate && !isLazyLoadImage(candidate)) {
        imageUrl = candidate
        imageSourceDomain = new URL(rawItem.url).hostname.replace('www.', '')
        break
      }
    }

    for (const rawItem of articleRawItems) {
      if (rawItem?.video_url) {
        videoUrl = rawItem.video_url
        break
      }
    }

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

    if (!imageUrl) {
      imageUrl = `https://via.placeholder.com/1200x630?text=${encodeURIComponent(item.title?.slice(0, 30) || 'Lophos News')}`
      console.warn(`[${topic}] 📸 Placeholder - ${item.title?.slice(0, 50)}`)
    } else if (imageSourceDomain) {
      console.log(`[${topic}] 🖼️  Imagem de ${imageSourceDomain}`)
    }

    const sources = articleSourceIds
      .map((uuid) => {
        const rawItem = rawItemsMap.get(uuid)
        if (!rawItem?.url) {
          console.warn(`[${topic}] ⚠️  UUID ${uuid.substring(0, 8)}... sem URL no raw_items`)
          return null
        }
        return buildNewsSourceFromItem(rawItem)
      })
      .filter(Boolean)

    const keywords = Array.isArray(item.keywords)
      ? [...new Set([topic, ...item.keywords.map((k) => String(k).toLowerCase().trim())])]
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
      source_ids: articleSourceIds,
    })
  }

  return {
    newsItems,
    success: true,
    processedClusterSourceIds: Array.from(allProcessedClusterSourceIds),
    quarantinedClusterSourceIds: Array.from(quarantinedClusterSourceIds),
  }
}
