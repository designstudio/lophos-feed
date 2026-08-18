/**
 * Editorial news processing.
 *
 * Defaults to the production Mistral flow. The isolated manual wrapper sets
 * NEWS_PROCESS_PROVIDER=gemma and reads only manual_ready cluster runs.
 */

import { createClient } from '@supabase/supabase-js'
import { buildArticleDedupProfile, buildNewsSourceFromItem, canonicalizeUrl, findBestArticleDuplicateMatch, shouldRejectPreflightItem, strongIntersection, textOverlapScore } from './news-pipeline-core.mjs'
import { loadScriptEnvironment } from './script-env.mjs'
import { processTopicWithGemma, processTopicWithMistral } from './news-mistral-core.mjs'

const SIMILARITY_THRESHOLD = 0.30
const MIN_STRONG_TOKENS = 3
const RAW_ITEM_ID_BATCH_SIZE = 100
const DEDUP_HISTORY_LIMIT = Number(process.env.MISTRAL_DEDUP_HISTORY_LIMIT || 1000)
const DEBUG_DEDUP = process.env.DEBUG_DEDUP === '1'

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

const DEAL_SOURCE_HINTS = ['promobit', 'pelando', 'buscape', 'zoom.com', 'cuponomia', 'meliuz']

loadScriptEnvironment()

function parseCliOptions(argv) {
  const options = {
    provider: process.env.NEWS_PROCESS_PROVIDER || 'mistral',
    topics: [],
    maxClustersPerTopic: Number.POSITIVE_INFINITY,
    dryRun: false,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--provider=')) options.provider = arg.slice('--provider='.length)
    else if (arg.startsWith('--topics=')) {
      options.topics = arg
        .slice('--topics='.length)
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean)
    } else if (arg.startsWith('--max-clusters-per-topic=')) {
      const value = Number(arg.slice('--max-clusters-per-topic='.length))
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--max-clusters-per-topic must be a positive integer')
      }
      options.maxClustersPerTopic = value
    }
  }

  options.provider = options.provider.trim().toLowerCase()
  return options
}

const CLI_OPTIONS = parseCliOptions(process.argv.slice(2))
const PROVIDER_NAME = CLI_OPTIONS.provider === 'gemma' ? 'Gemma/Ollama' : 'Mistral'
const PROCESS_TOPIC = CLI_OPTIONS.provider === 'gemma' ? processTopicWithGemma : processTopicWithMistral
const CLUSTER_RUN_STATUS = process.env.NEWS_CLUSTER_RUN_STATUS || (CLI_OPTIONS.provider === 'gemma' ? 'manual_ready' : 'ready')
const DELAY_BETWEEN_TOPICS_MS = Number(
  CLI_OPTIONS.provider === 'gemma'
    ? process.env.OLLAMA_TOPIC_DELAY_MS || 0
    : process.env.MISTRAL_TOPIC_DELAY_MS || 1500,
)

function printUsage() {
  const command = CLI_OPTIONS.provider === 'gemma'
    ? 'npm run news:process-gemma --'
    : 'npm run news:process-mistral --'
  console.log(`Uso:
  ${command} [opções]

Opções:
  --provider=mistral|gemma
  --topics=horror,movies,tecnologia
  --max-clusters-per-topic=3
  --dry-run
  --help`)
}

function assertEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean))]
}

async function loadRawItemStates(db, ids) {
  const rows = []

  for (let offset = 0; offset < ids.length; offset += RAW_ITEM_ID_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + RAW_ITEM_ID_BATCH_SIZE)
    const { data, error } = await db
      .from('raw_items')
      .select('id, processed')
      .in('id', batch)

    if (error) {
      const batchNumber = Math.floor(offset / RAW_ITEM_ID_BATCH_SIZE) + 1
      throw new Error(`Could not load raw item states (batch ${batchNumber}): ${error.message}`)
    }

    rows.push(...(data || []))
  }

  return rows
}

function sanitizeArticleForSave(article) {
  const {
    _dedupProfile,
    _isPendingDedupCandidate,
    ...persisted
  } = article || {}
  return {
    ...persisted,
    topic: persisted.topic || '',
  }
}

function articleComparableText(article) {
  const sectionsText = Array.isArray(article?.sections)
    ? article.sections
        .map((section) => `${section?.heading || ''} ${section?.body || ''}`)
        .join(' ')
    : ''

  return [
    article?.title,
    article?.summary,
    sectionsText,
    article?.conclusion,
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
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

async function loadLatestClusterRun(db, status) {
  const { data, error } = await db
    .from('news_cluster_runs')
    .select('id, payload, status, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Cluster run DB error: ${error.message}`)
  }

  return data || null
}

async function main() {
  if (CLI_OPTIONS.help) {
    printUsage()
    return
  }

  if (!['mistral', 'gemma'].includes(CLI_OPTIONS.provider)) {
    throw new Error(`Unsupported editorial provider: ${CLI_OPTIONS.provider}`)
  }

  const db = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const clusterRun = await loadLatestClusterRun(db, CLUSTER_RUN_STATUS)
  if (!clusterRun?.payload?.topics?.length) {
    console.log(`No ${CLUSTER_RUN_STATUS} cluster runs found. Prepare a cluster run first.`)
    return
  }

  const requestedTopics = new Set(CLI_OPTIONS.topics.map((topic) => topic.toLocaleLowerCase('pt-BR')))
  const availableTopicPayloads = clusterRun.payload.topics || []
  const unknownTopics = [...requestedTopics].filter((requested) => (
    !availableTopicPayloads.some((entry) => entry.topic?.toLocaleLowerCase('pt-BR') === requested)
  ))

  if (unknownTopics.length > 0) {
    throw new Error(`Topics not found in cluster run: ${unknownTopics.join(', ')}`)
  }

  let topicPayloads = availableTopicPayloads
    .filter((entry) => requestedTopics.size === 0 || requestedTopics.has(entry.topic?.toLocaleLowerCase('pt-BR')))
    .map((entry) => {
      const clusters = (entry.clusters || []).slice(0, CLI_OPTIONS.maxClustersPerTopic)
      const selectedIds = new Set(clusters.flat())
      return {
        ...entry,
        clusters,
        acceptedItems: (entry.acceptedItems || []).filter((item) => selectedIds.has(item.id)),
        rejectedRawIds: Number.isFinite(CLI_OPTIONS.maxClustersPerTopic) ? [] : entry.rejectedRawIds || [],
      }
    })

  if (topicPayloads.length === 0) {
    console.log('No topics selected for editorial processing.')
    return
  }

  const candidateRawIds = uniqueIds(topicPayloads.flatMap((entry) => (entry.clusters || []).flat()))
  if (candidateRawIds.length > 0) {
    const rawStates = await loadRawItemStates(db, candidateRawIds)

    const alreadyProcessedIds = new Set((rawStates || []).filter((row) => row.processed).map((row) => row.id))
    topicPayloads = topicPayloads
      .map((entry) => {
        const clusters = (entry.clusters || []).filter((cluster) => (
          cluster.some((id) => !alreadyProcessedIds.has(id))
        ))
        const selectedIds = new Set(clusters.flat())
        return {
          ...entry,
          clusters,
          acceptedItems: (entry.acceptedItems || []).filter((item) => selectedIds.has(item.id)),
        }
      })
      .filter((entry) => entry.clusters.length > 0 || (entry.rejectedRawIds || []).length > 0)
  }

  if (topicPayloads.length === 0) {
    console.log('All selected clusters have already been processed.')
    return
  }

  const windowHours = clusterRun.payload.windowHours || 12
  const historyHours = clusterRun.payload.historyHours || 72
  const selectedRawIds = new Set(topicPayloads.flatMap((entry) => (entry.clusters || []).flat()))
  const semanticMatches = (Array.isArray(clusterRun.payload.semanticMatches) ? clusterRun.payload.semanticMatches : [])
    .filter((match) => selectedRawIds.has(match.currentId))
  const semanticDuplicateRawIds = uniqueIds(clusterRun.payload.semanticDuplicateRawIds || [])
    .filter((id) => selectedRawIds.has(id))
  const isPartialRun = requestedTopics.size > 0 || Number.isFinite(CLI_OPTIONS.maxClustersPerTopic)

  console.log(`\n🧪 ${PROVIDER_NAME} editorial processing`)
  console.log(`Cluster run: ${clusterRun.id} (${clusterRun.created_at})`)
  console.log(`Status isolado: ${CLUSTER_RUN_STATUS}${isPartialRun ? ' | execução parcial' : ''}`)
  console.log(`Janela de entrada: últimas ${windowHours}h | histórico de comparação: ${historyHours}h`)
  console.log(`Topics selecionados: ${topicPayloads.map((entry) => `${entry.topic} (${entry.clusters.length} clusters)`).join(', ')}\n`)
  console.log(`Pendências semânticas: matches=${semanticMatches.length} raw_ids=${semanticDuplicateRawIds.length}\n`)

  if (CLI_OPTIONS.dryRun) {
    console.log('Dry run concluído; nenhuma chamada de IA ou escrita no banco foi realizada.')
    return
  }

  const sinceDedup = new Date(Date.now() - historyHours * 60 * 60 * 1000).toISOString()
  const { data: globalExisting } = await db
    .from('articles')
    .select('id, title, summary, sections, conclusion, sources, source_ids, keywords, matched_topics, image_url, video_url')
    .gte('published_at', sinceDedup)
    .order('published_at', { ascending: false })
    .limit(DEDUP_HISTORY_LIMIT)

  const allProcessedArticles = (globalExisting || []).map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary || '',
    sections: r.sections || [],
    conclusion: r.conclusion || '',
    sources: r.sources || [],
    source_ids: r.source_ids || [],
    keywords: r.keywords || [],
    matched_topics: r.matched_topics || [],
    image_url: r.image_url || null,
    video_url: r.video_url || null,
    _dedupProfile: buildArticleDedupProfile(r),
  }))
  console.log(`Artigos existentes (últimas ${historyHours}h): ${allProcessedArticles.length}\n`)

  let totalGenerated = 0
  let totalMerged = 0
  let totalSaved = 0
  let totalSemanticAttached = 0
  let hadTopicError = false
  const semanticProcessedRawIds = new Set()

  for (let ti = 0; ti < topicPayloads.length; ti++) {
    const topicPayload = topicPayloads[ti]
    const topic = topicPayload.topic
    const acceptedItems = topicPayload.acceptedItems || []
    const clusters = topicPayload.clusters || []
    const rejectedRawIds = uniqueIds(topicPayload.rejectedRawIds || [])
    const topicPendingArticles = []

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
      console.log(`[${topic}] ${acceptedItems.length} items → ${PROVIDER_NAME} (${clusters.length} clusters)`)

      const rawItemsMap = new Map(acceptedItems.map((item) => [item.id, item]))
      const results = acceptedItems.map((item) => ({
        url: item.url,
        title: item.title,
        summary: item.summary || '',
        content: item.content || '',
        sourceName: item.source_name || '',
        sourceUrl: item.source_url || '',
        pubDate: item.pub_date || '',
        image: item.image_url,
        video: item.video_url,
      }))

      const providerResult = await PROCESS_TOPIC(
        topic,
        results,
        allProcessedArticles.map((a) => a.title),
        clusters,
        rawItemsMap,
      )

      const {
        newsItems,
        providerError,
        processedClusterSourceIds,
        rejectedRawIds: localRejectedRawIds = [],
        failedClusterSourceIds = [],
      } = providerResult

      const dedupedItems = []
      const successfullyProcessedRawIds = new Set([
        ...rejectedRawIds,
        ...localRejectedRawIds,
        ...(processedClusterSourceIds || []),
      ])

      if (providerError) {
        hadTopicError = true
        console.warn(`[${topic}] ⚠️  Um ou mais clusters falharam no ${PROVIDER_NAME} (${failedClusterSourceIds.length} source_ids). Continuando com os artigos já gerados.`)
        if (successfullyProcessedRawIds.size > 0) {
          await db.from('raw_items')
            .update({ processed: true })
            .in('id', Array.from(successfullyProcessedRawIds))
        }
      }

      for (const item of newsItems) {
        const contentDecision = shouldRejectPreflightItem({
          title: item.title,
          description: item.summary || '',
          url: Array.isArray(item.sources) ? item.sources.map((source) => source?.url).filter(Boolean).join(' \n ') : '',
          sourceName: Array.isArray(item.sources) ? item.sources.map((source) => source?.name).filter(Boolean).join(' \n ') : '',
          sections: item.sections || [],
        })

        if (contentDecision.reject) {
          console.log(`[${topic}] ⛔ article filtered (${contentDecision.reason}): ${item.title?.slice(0, 90)}`)
          if (Array.isArray(item.source_ids)) {
            item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
          }
          continue
        }

        const dedupMatch = findBestArticleDuplicateMatch(item, [...allProcessedArticles, ...topicPendingArticles], {
          similarityThreshold: 0.22,
          minStrongTokens: 2,
          minTitleScore: 0.4,
          minTitleSharedTokens: 2,
          minCompactTitleScore: 0.4,
          minCompactTitleTokens: 2,
          minSupportScore: 0.18,
          minSupportTokens: 2,
        })

        if (dedupMatch) {
          const match = dedupMatch.candidate
          const score = dedupMatch.score
          const anchor = dedupMatch.strong || []
          console.log(`  [DEDUP] ?? MERGE score=${score.toFixed(3)} anchor=[${anchor.join(',')}] id=${match.id?.slice(0, 8)} | existing="${match.title?.slice(0, 55)}" ? new="${item.title?.slice(0, 55)}"`)
          const existingUrls = new Set((match.sources || []).map((s) => canonicalizeUrl(s.url)))
          const newSources = item.sources.filter((s) => !existingUrls.has(canonicalizeUrl(s.url)))
          const mergedKeywords = [...new Set([...match.keywords, ...(item.keywords || [])])]
          const mergedMatchedTopics = [...new Set([...match.matched_topics, ...(item.matched_topics || [])])]
          const mergedSourceIds = uniqueIds([...(match.source_ids || []), ...(item.source_ids || [])])
          const shouldBackfillImage = !match.image_url && !!item.image_url
          const shouldBackfillVideo = !match.video_url && !!item.video_url

          const keywordsChanged = mergedKeywords.length > match.keywords.length
          const topicsChanged = mergedMatchedTopics.length > match.matched_topics.length
          const sourceIdsChanged = mergedSourceIds.length > (match.source_ids || []).length

          if (newSources.length > 0 || keywordsChanged || topicsChanged || sourceIdsChanged || shouldBackfillImage || shouldBackfillVideo) {
            const mergedSources = [...match.sources, ...newSources]
            const updatePayload = {
              sources: mergedSources,
              source_ids: mergedSourceIds,
              keywords: mergedKeywords,
              matched_topics: mergedMatchedTopics,
            }
            if (shouldBackfillImage) updatePayload.image_url = item.image_url
            if (shouldBackfillVideo) updatePayload.video_url = item.video_url

            const { error: mergeError } = match._isPendingDedupCandidate
              ? { error: null }
              : await db
                .from('articles')
                .update(updatePayload)
                .eq('id', match.id)

            if (mergeError) {
              console.error(`[${topic}] ??  Merge error: ${mergeError.message}. Item n�o ser� marcado como processado.`)
            } else {
              match.sources = mergedSources
              match.source_ids = mergedSourceIds
              match.keywords = mergedKeywords
              match.matched_topics = mergedMatchedTopics
              if (shouldBackfillImage) match.image_url = item.image_url
              if (shouldBackfillVideo) match.video_url = item.video_url
              match._dedupProfile = buildArticleDedupProfile(match)
              totalMerged++
              if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
                item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
              }
            }
          } else if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
            item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
          }
        } else {
          if (DEBUG_DEDUP) {
            console.log(`  [DEDUP] ? NEW "${item.title?.slice(0, 60)}"`)
          }
          const pendingArticle = {
            id: item.id,
            topic,
            title: item.title,
            summary: item.summary || '',
            sections: item.sections || [],
            conclusion: item.conclusion || '',
            sources: item.sources,
            source_ids: item.source_ids || [],
            keywords: item.keywords || [],
            matched_topics: item.matched_topics || [],
            image_url: item.image_url || null,
            video_url: item.video_url || null,
            _isPendingDedupCandidate: true,
            _dedupProfile: buildArticleDedupProfile(item),
          }
          dedupedItems.push(pendingArticle)
          topicPendingArticles.push(pendingArticle)
        }

      }

      const validArticles = []
      const invalidArticles = []

      for (const item of dedupedItems) {
        if (!Array.isArray(item.source_ids) || item.source_ids.length === 0) {
          console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com ZERO fontes! "${item.title?.slice(0, 50)}"`)
          invalidArticles.push(item)
          continue
        }

        if (!Array.isArray(item.sources) || item.sources.length === 0) {
          console.error(`[${topic}] ❌ REJEIÇÃO: Artigo com array sources vazio! "${item.title?.slice(0, 50)}"`)
          invalidArticles.push(item)
          continue
        }

        validArticles.push(item)
      }

      const articlesToSave = validArticles.map((article) => sanitizeArticleForSave(article))

      if (articlesToSave.length > 0) {
        console.log(`[${topic}] 📦 Gravando no BD: ${articlesToSave.length} artigos`)
        const { error: saveError } = await db.from('articles').upsert(articlesToSave, { onConflict: 'id' })

        if (saveError) {
          console.error(`[${topic}] ⚠️  Save error: ${saveError.message}. ${articlesToSave.length} items não serão marcados como processados.`)
        } else {
          console.log(`[${topic}] ✅ ${articlesToSave.length} artigos salvos com sucesso`)
          totalSaved += articlesToSave.length

          for (const item of articlesToSave) {
            allProcessedArticles.push({
              id: item.id,
              topic: item.topic || topic,
              title: item.title,
              summary: item.summary || '',
              sections: item.sections || [],
              conclusion: item.conclusion || '',
              sources: item.sources,
              source_ids: item.source_ids || [],
              keywords: item.keywords || [],
              matched_topics: item.matched_topics || [],
              _dedupProfile: buildArticleDedupProfile(item),
            })
            item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
          }
        }
      }

      if (invalidArticles.length > 0) {
        console.warn(`[${topic}] ⚠️  ${invalidArticles.length} artigos rejeitados (zero fontes)`)
      }

      totalGenerated += dedupedItems.length

      if (successfullyProcessedRawIds.size > 0) {
        const processedIds = Array.from(successfullyProcessedRawIds)
        const { error: updateError } = await db.from('raw_items')
          .update({ processed: true })
          .in('id', processedIds)

        if (updateError) {
          console.error(`[${topic}] ⚠️  Failed to mark items as processed: ${updateError.message}`)
        } else {
          console.log(`[${topic}] ✓ ${processedIds.length} items marcados como processados`)
        }
      }

      if (ti < topicPayloads.length - 1) {
        console.log(`Aguardando ${DELAY_BETWEEN_TOPICS_MS / 1000}s antes do próximo tópico...\n`)
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_TOPICS_MS))
      }
    } catch (err) {
      hadTopicError = true
      console.error(`[${topic}] ⚠️  Erro crítico: ${err.message}. Items não serão marcados como processados.`)
    }
  }

  if (semanticMatches.length > 0) {
    console.log(`\n[semantic] Attachando ${semanticMatches.length} duplicatas como fontes extras`)

    const currentSemanticIds = uniqueIds(semanticMatches.map((match) => match.currentId))
    const historySemanticIds = uniqueIds(semanticMatches.map((match) => match.historyId))

    const [currentSemanticRows, historySemanticRows] = await Promise.all([
      currentSemanticIds.length > 0
        ? db
          .from('raw_items')
          .select('id, url, title, summary, source_name, source_url, topic, image_url, video_url')
          .in('id', currentSemanticIds)
        : Promise.resolve({ data: [], error: null }),
      historySemanticIds.length > 0
        ? db
          .from('raw_items')
          .select('id, url, title, summary, source_name, source_url, topic, image_url, video_url')
          .in('id', historySemanticIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (currentSemanticRows.error) {
      console.warn(`[semantic] Could not load current raw items: ${currentSemanticRows.error.message}`)
    }
    if (historySemanticRows.error) {
      console.warn(`[semantic] Could not load history raw items: ${historySemanticRows.error.message}`)
    }

    const currentRawById = new Map((currentSemanticRows.data || []).map((row) => [row.id, row]))
    const historyRawById = new Map((historySemanticRows.data || []).map((row) => [row.id, row]))

    const articleById = new Map()
    const articleBySourceId = new Map()
    const articleBySourceUrl = new Map()

    const indexArticle = (article) => {
      if (!article?.id) return
      articleById.set(article.id, article)

      for (const sourceId of article.source_ids || []) {
        if (sourceId && !articleBySourceId.has(sourceId)) {
          articleBySourceId.set(sourceId, article)
        }
      }

      for (const source of article.sources || []) {
        const canonicalSourceUrl = canonicalizeUrl(source?.url || '')
        if (canonicalSourceUrl && !articleBySourceUrl.has(canonicalSourceUrl)) {
          articleBySourceUrl.set(canonicalSourceUrl, article)
        }
      }
    }

    allProcessedArticles.forEach(indexArticle)

    const attachmentsByArticleId = new Map()

    for (const match of semanticMatches) {
      const currentRaw = currentRawById.get(match.currentId)
      const historyRaw = historyRawById.get(match.historyId)
      if (!currentRaw || !historyRaw) continue

      let targetArticle = articleBySourceId.get(match.historyId) || null

      if (!targetArticle) {
        const historyUrl = canonicalizeUrl(historyRaw.url || '')
        if (historyUrl) {
          targetArticle = articleBySourceUrl.get(historyUrl) || null
        }
      }

      if (!targetArticle) {
        const { data: anchorBySourceId, error: anchorBySourceIdError } = await db
          .from('articles')
          .select('id, title, summary, sections, conclusion, sources, source_ids, keywords, matched_topics, image_url, video_url')
          .contains('source_ids', [match.historyId])
          .limit(1)
          .maybeSingle()

        if (anchorBySourceIdError) {
          console.warn(`[semantic] Could not load anchor by source_id for ${match.historyId.slice(0, 8)}: ${anchorBySourceIdError.message}`)
        } else if (anchorBySourceId) {
          targetArticle = {
            id: anchorBySourceId.id,
            title: anchorBySourceId.title,
            summary: anchorBySourceId.summary || '',
            sections: anchorBySourceId.sections || [],
            conclusion: anchorBySourceId.conclusion || '',
            sources: anchorBySourceId.sources || [],
            source_ids: anchorBySourceId.source_ids || [],
            keywords: anchorBySourceId.keywords || [],
            matched_topics: anchorBySourceId.matched_topics || [],
            image_url: anchorBySourceId.image_url || null,
            video_url: anchorBySourceId.video_url || null,
          }
          indexArticle(targetArticle)
        }
      }

      if (!targetArticle) {
        const fallbackText = `${historyRaw.title || ''} ${historyRaw.summary || ''}`.trim()
        if (fallbackText) {
          targetArticle = allProcessedArticles.find((article) => {
            const candidateText = articleComparableText(article)
            return textOverlapScore(candidateText, fallbackText) >= SIMILARITY_THRESHOLD
          }) || null
        }
      }

      if (!targetArticle) {
        console.warn(`[semantic] Could not resolve article anchor for ${match.currentId.slice(0, 8)} → ${match.historyId.slice(0, 8)} (${match.historyTitle?.slice(0, 60) || 'unknown'})`)
        continue
      }

      const bucket = attachmentsByArticleId.get(targetArticle.id) || {
        article: targetArticle,
        rawItems: [],
        matches: [],
      }

      bucket.rawItems.push(currentRaw)
      bucket.matches.push(match)
      attachmentsByArticleId.set(targetArticle.id, bucket)
    }

    for (const { article, rawItems } of attachmentsByArticleId.values()) {
      const existingSourceUrls = new Set((article.sources || []).map((source) => canonicalizeUrl(source?.url || '')))
      const mergedSources = [...(article.sources || [])]
      const mergedSourceIds = uniqueIds([...(article.source_ids || [])])
      const mergedMatchedTopics = uniqueIds([...(article.matched_topics || [])])
      let shouldBackfillImage = !article.image_url
      let shouldBackfillVideo = !article.video_url

      for (const rawItem of rawItems) {
        const newsSource = buildNewsSourceFromItem(rawItem)
        const sourceUrl = canonicalizeUrl(newsSource.url || rawItem.url || rawItem.source_url || '')

        if (sourceUrl && !existingSourceUrls.has(sourceUrl)) {
          mergedSources.push(newsSource)
          existingSourceUrls.add(sourceUrl)
        }

        mergedSourceIds.push(rawItem.id)

        if (rawItem.topic) mergedMatchedTopics.push(rawItem.topic)
        if (rawItem.image_url && !article.image_url) shouldBackfillImage = true
        if (rawItem.video_url && !article.video_url) shouldBackfillVideo = true
      }

      const finalSourceIds = uniqueIds(mergedSourceIds)
      const finalMatchedTopics = uniqueIds(mergedMatchedTopics)
      const sourceIdsChanged = finalSourceIds.length !== (article.source_ids || []).length
      const sourcesChanged = mergedSources.length !== (article.sources || []).length
      const topicsChanged = finalMatchedTopics.length !== (article.matched_topics || []).length

      if (!sourcesChanged && !sourceIdsChanged && !topicsChanged && !shouldBackfillImage && !shouldBackfillVideo) {
        for (const rawItem of rawItems) {
          semanticProcessedRawIds.add(rawItem.id)
          totalSemanticAttached++
        }
        continue
      }

      const updatePayload = {
        sources: mergedSources,
        source_ids: finalSourceIds,
        matched_topics: finalMatchedTopics,
      }
      if (shouldBackfillImage) {
        const firstImage = rawItems.find((rawItem) => rawItem.image_url)?.image_url
        if (firstImage) updatePayload.image_url = firstImage
      }
      if (shouldBackfillVideo) {
        const firstVideo = rawItems.find((rawItem) => rawItem.video_url)?.video_url
        if (firstVideo) updatePayload.video_url = firstVideo
      }

      const { error: attachError } = await db
        .from('articles')
        .update(updatePayload)
        .eq('id', article.id)

      if (attachError) {
        console.warn(`[semantic] Could not attach sources to article ${article.id}: ${attachError.message}`)
        continue
      }

      article.sources = mergedSources
      article.source_ids = finalSourceIds
      article.matched_topics = finalMatchedTopics
      if (updatePayload.image_url) article.image_url = updatePayload.image_url
      if (updatePayload.video_url) article.video_url = updatePayload.video_url
      indexArticle(article)

      for (const rawItem of rawItems) {
        semanticProcessedRawIds.add(rawItem.id)
        totalSemanticAttached++
      }

      console.log(`[semantic] ✓ artigo ${article.id} recebeu ${rawItems.length} fonte(s) extra(s)`)
    }

    if (semanticProcessedRawIds.size > 0) {
      const { error: semanticMarkError } = await db
        .from('raw_items')
        .update({ processed: true })
        .in('id', Array.from(semanticProcessedRawIds))

      if (semanticMarkError) {
        console.warn(`[semantic] Could not mark attached semantic duplicates as processed: ${semanticMarkError.message}`)
      } else {
        console.log(`[semantic] ✓ ${semanticProcessedRawIds.size} semantic duplicate raw items marcados como processados`)
      }
    }
  }

  if (isPartialRun) {
    console.log(`Cluster run ${clusterRun.id} preservado como ${CLUSTER_RUN_STATUS} para os tópicos restantes.`)
  } else {
    const finalStatus = hadTopicError ? 'failed' : 'processed'
    const { error: statusUpdateError } = await db
      .from('news_cluster_runs')
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString(),
        error_message: hadTopicError ? `One or more topics failed during ${PROVIDER_NAME} processing` : null,
      })
      .eq('id', clusterRun.id)

    if (statusUpdateError) {
      console.warn(`Could not update cluster run status: ${statusUpdateError.message}`)
    } else {
      console.log(`Cluster run ${clusterRun.id} marked as ${finalStatus}.`)
    }
  }

  const totalProcessed = totalSaved + totalMerged
  console.log(`\n✨ PROCESSAMENTO ${PROVIDER_NAME.toUpperCase()} CONCLUÍDO!`)
  console.log(`Topics: ${topicPayloads.length} | Artigos gerados: ${totalGenerated} | Salvos: ${totalSaved} | Merges: ${totalMerged}`)
  console.log(`Duplicatas semânticas anexadas: ${totalSemanticAttached}`)
  console.log(`Total processado com sucesso: ${totalProcessed} notícias 🎉\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
