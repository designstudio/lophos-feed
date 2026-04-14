/**
 * Gemini-only news processing
 *
 * Consome um cluster run já preparado, chama o Gemini para sintetizar
 * e persiste articles/raw_items processed.
 */

import { createClient } from '@supabase/supabase-js'
import { canonicalizeUrl, strongIntersection, textOverlapScore } from './news-pipeline-core.mjs'
import { processTopicWithGemini } from './process-news.mjs'

const SIMILARITY_THRESHOLD = 0.30
const MIN_STRONG_TOKENS = 3
const DELAY_BETWEEN_TOPICS_MS = 100
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

async function loadLatestClusterRun(db) {
  const { data, error } = await db
    .from('news_cluster_runs')
    .select('id, payload, status, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Cluster run DB error: ${error.message}`)
  }

  return data || null
}

async function main() {
  const db = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const clusterRun = await loadLatestClusterRun(db)
  if (!clusterRun?.payload?.topics?.length) {
    console.log('No ready cluster runs found. Run news:preflight and news:cluster first.')
    return
  }

  const topicPayloads = clusterRun.payload.topics || []
  const windowHours = clusterRun.payload.windowHours || 12
  const historyHours = clusterRun.payload.historyHours || 72

  console.log(`\n🧪 Gemini-only processing`)
  console.log(`Cluster run: ${clusterRun.id} (${clusterRun.created_at})`)
  console.log(`Janela de entrada: últimas ${windowHours}h | histórico de comparação: ${historyHours}h`)
  console.log(`Topics prontos para Gemini: ${topicPayloads.map((entry) => entry.topic).join(', ')}\n`)

  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  const { data: globalExisting } = await db
    .from('articles')
    .select('id, title, summary, sources, keywords, matched_topics, image_url, video_url')
    .gte('published_at', since72h)
    .order('published_at', { ascending: false })
    .limit(300)

  const allProcessedArticles = (globalExisting || []).map((r) => ({
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
      const results = acceptedItems.map((item) => ({
        url: item.url,
        title: item.title,
        content: item.content || '',
        image: item.image_url,
        video: item.video_url,
      }))

      const {
        newsItems,
        geminiError,
        processedClusterSourceIds,
        rejectedRawIds: localRejectedRawIds = [],
      } = await processTopicWithGemini(
        topic,
        results,
        allProcessedArticles.map((a) => a.title),
        clusters,
        rawItemsMap,
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
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_TOPICS_MS))
        }
        continue
      }

      for (const item of newsItems) {
        const contentDecision = shouldRejectContent({
          title: item.title,
          summary: item.summary,
          sections: item.sections || [],
          urls: Array.isArray(item.sources) ? item.sources.map((source) => source?.url).filter(Boolean) : [],
          sourceNames: Array.isArray(item.sources) ? item.sources.map((source) => source?.name).filter(Boolean) : [],
        })

        if (contentDecision.reject) {
          console.log(`[${topic}] ⛔ article filtered (${contentDecision.reason}): ${item.title?.slice(0, 90)}`)
          if (Array.isArray(item.source_ids)) {
            item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
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

        if (bestMatch) {
          const match = bestMatch
          console.log(`  [DEDUP] 🔀 MERGE score=${bestScore.toFixed(3)} anchor=[${bestStrongCommon.join(',')}] id=${match.id?.slice(0, 8)} | existing="${match.title?.slice(0, 55)}" → new="${item.title?.slice(0, 55)}"`)
          const existingUrls = new Set((match.sources || []).map((s) => canonicalizeUrl(s.url)))
          const newSources = item.sources.filter((s) => !existingUrls.has(canonicalizeUrl(s.url)))
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
                item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
              }
            }
          } else if (Array.isArray(item.source_ids) && item.source_ids.length > 0) {
            item.source_ids.forEach((id) => successfullyProcessedRawIds.add(id))
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

      if (validArticles.length > 0) {
        console.log(`[${topic}] 📦 Gravando no BD: ${validArticles.length} artigos`)
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
  console.log(`\n✨ FAXINA CONCLUÍDA!`)
  console.log(`Topics: ${topicPayloads.length} | Artigos gerados: ${totalGenerated} | Salvos: ${totalSaved} | Merges: ${totalMerged}`)
  console.log(`Total processado com sucesso: ${totalProcessed} notícias 🎉\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
