import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

/**
 * Manual retroactive article dedupe. It is always a dry run unless --apply is
 * explicitly provided.
 *
 *   npm run news:dedupe
 *   npm run news:dedupe -- --days=7
 *   npm run news:dedupe -- --days=7 --apply
 */
import {
  canonicalizeUrl,
  normalizeText,
} from './news-pipeline-core.mjs'
import {
  DEFAULT_V2_OPTIONS,
  clusterItemsV2,
  composeEventText,
  embedEventTexts,
  loadLocalEmbeddingExtractor,
} from './news-cluster-v2-core.mjs'
import { adaptArticleForV2, buildArticleDuplicateGroups } from './article-dedupe-core.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const contents = fs.readFileSync(filePath, 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    if (!key || process.env[key]) continue

    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function bootstrapEnv() {
  loadEnvFile(path.join(process.cwd(), '.env.local'))
  loadEnvFile(path.join(process.cwd(), '.env'))
  loadEnvFile(path.join(__dirname, '..', '.env.local'))
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function parseArgs(argv) {
  const args = {
    days: 3,
    semanticThreshold: DEFAULT_V2_OPTIONS.semanticThreshold,
    highConfidenceThreshold: DEFAULT_V2_OPTIONS.highConfidenceThreshold,
    maxPairHours: DEFAULT_V2_OPTIONS.maxPairHours,
    topK: DEFAULT_V2_OPTIONS.topK,
    modelId: process.env.EMBEDDING_MODEL || DEFAULT_V2_OPTIONS.modelId,
    apply: false,
    limit: 5000,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') {
      args.apply = true
      continue
    }

    if (arg.startsWith('--days=')) {
      args.days = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--days' && argv[i + 1]) {
      args.days = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--semantic-threshold=')) {
      args.semanticThreshold = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--semantic-threshold' && argv[i + 1]) {
      args.semanticThreshold = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--high-confidence-threshold=')) {
      args.highConfidenceThreshold = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--high-confidence-threshold' && argv[i + 1]) {
      args.highConfidenceThreshold = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--max-pair-hours=')) {
      args.maxPairHours = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--max-pair-hours' && argv[i + 1]) {
      args.maxPairHours = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--top-k=')) {
      args.topK = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--top-k' && argv[i + 1]) {
      args.topK = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--model=')) {
      args.modelId = arg.split('=').slice(1).join('=')
      continue
    }
    if (arg === '--model' && argv[i + 1]) {
      args.modelId = argv[i + 1]
      i += 1
      continue
    }

    if (arg.startsWith('--limit=')) {
      args.limit = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--threshold' || arg.startsWith('--threshold=') || arg === '--min-strong' || arg.startsWith('--min-strong=')) {
      throw new Error('Legacy lexical flags were removed. Use --semantic-threshold (default 0.86) for the V2 dedupe.')
    }
  }

  return args
}

function articleDate(article) {
  const candidates = [
    article.published_at,
    article.cached_at,
  ]

  for (const value of candidates) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isNaN(time)) return time
  }

  return 0
}

function normalizeList(values) {
  return [...new Set(
    (values || [])
      .map((value) => normalizeText(value))
      .map((value) => value.trim())
      .filter(Boolean),
  )]
}

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function sourceKey(source) {
  const url = canonicalizeUrl(source?.url || '')
  const name = normalizeText(source?.name || '')
  return url || name
}

function mergeSources(baseSources, extraSources) {
  const merged = []
  const seen = new Set()

  for (const source of [...(baseSources || []), ...(extraSources || [])]) {
    if (!source) continue
    const key = sourceKey(source)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(source)
  }

  return merged
}

function mergeArticleFields(keeper, duplicate) {
  const mergedSources = mergeSources(keeper.sources, duplicate.sources)
  const mergedSourceIds = uniqueIds([
    ...(keeper.source_ids || []),
    ...(duplicate.source_ids || []),
  ])
  const mergedKeywords = normalizeList([
    ...(keeper.keywords || []),
    ...(duplicate.keywords || []),
  ])
  const mergedMatchedTopics = normalizeList([
    ...(keeper.matched_topics || []),
    ...(duplicate.matched_topics || []),
    ...(keeper.keywords || []),
    ...(duplicate.keywords || []),
    keeper.topic,
    duplicate.topic,
  ])

  const payload = {}
  if (JSON.stringify(mergedSources) !== JSON.stringify(keeper.sources || [])) {
    payload.sources = mergedSources
  }
  if (JSON.stringify(mergedSourceIds) !== JSON.stringify(keeper.source_ids || [])) {
    payload.source_ids = mergedSourceIds
  }
  if (JSON.stringify(mergedKeywords) !== JSON.stringify(keeper.keywords || [])) {
    payload.keywords = mergedKeywords
  }
  if (JSON.stringify(mergedMatchedTopics) !== JSON.stringify(keeper.matched_topics || [])) {
    payload.matched_topics = mergedMatchedTopics
  }
  if (!keeper.image_url && duplicate.image_url) {
    payload.image_url = duplicate.image_url
  }
  if (!keeper.video_url && duplicate.video_url) {
    payload.video_url = duplicate.video_url
  }

  return payload
}

async function main() {
  bootstrapEnv()

  const args = parseArgs(process.argv.slice(2))
  if (!Number.isFinite(args.days) || args.days <= 0) {
    throw new Error('--days must be a positive number')
  }
  if (!Number.isFinite(args.semanticThreshold) || args.semanticThreshold <= 0 || args.semanticThreshold > 1) {
    throw new Error('--semantic-threshold must be between 0 and 1')
  }
  if (!Number.isFinite(args.highConfidenceThreshold) || args.highConfidenceThreshold <= 0 || args.highConfidenceThreshold > 1) {
    throw new Error('--high-confidence-threshold must be between 0 and 1')
  }
  if (args.highConfidenceThreshold < args.semanticThreshold) {
    throw new Error('--high-confidence-threshold must be greater than or equal to --semantic-threshold')
  }
  if (!Number.isFinite(args.maxPairHours) || args.maxPairHours <= 0) {
    throw new Error('--max-pair-hours must be a positive number')
  }
  if (!Number.isInteger(args.topK) || args.topK <= 0) {
    throw new Error('--top-k must be a positive integer')
  }
  if (!args.modelId) {
    throw new Error('--model must not be empty')
  }
  if (!Number.isFinite(args.limit) || args.limit <= 0) {
    throw new Error('--limit must be a positive number')
  }

  const db = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const since = new Date()
  since.setDate(since.getDate() - args.days)
  const sinceIso = since.toISOString()
  const pageSize = 1000

  console.log(`[dedupe] Loading articles from the last ${args.days} day(s)...`)
  console.log(`[dedupe] Cutoff: ${sinceIso}`)
  console.log(`[dedupe] Engine: V2 semantic (${args.modelId})`)
  console.log(`[dedupe] Thresholds: semantic=${args.semanticThreshold} high=${args.highConfidenceThreshold} max_pair_hours=${args.maxPairHours} top_k=${args.topK}`)

  const rows = []
  let offset = 0

  while (rows.length < args.limit) {
    const batchSize = Math.min(pageSize, args.limit - rows.length)
    const { data: batch, error } = await db
      .from('articles')
      .select('id, topic, title, summary, sections, sources, source_ids, keywords, matched_topics, image_url, video_url, published_at, cached_at')
      .or(`published_at.gte.${sinceIso},cached_at.gte.${sinceIso}`)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('cached_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + batchSize - 1)

    if (error) {
      throw new Error(`Failed to load articles: ${error.message}`)
    }

    if (!batch?.length) break

    rows.push(...batch)
    if (batch.length < batchSize) break
    offset += batchSize
  }

  const articles = rows
    .map((article) => ({
      ...article,
      _sortKey: articleDate(article),
    }))
    .filter((article) => article._sortKey >= since.getTime())
    .sort((a, b) => b._sortKey - a._sortKey)

  console.log(`[dedupe] Loaded ${articles.length} recent article(s)`)

  if (articles.length < 2) {
    console.log('[dedupe] Nothing to merge.')
    return
  }

  const adaptedArticles = articles.map(adaptArticleForV2)
  const modelStarted = performance.now()
  console.log(`[dedupe] Loading local embedding model...`)
  const extractor = await loadLocalEmbeddingExtractor(args.modelId)
  console.log(`[dedupe] Model ready in ${((performance.now() - modelStarted) / 1000).toFixed(2)}s`)

  const embeddingStarted = performance.now()
  const vectors = await embedEventTexts(extractor, adaptedArticles.map(composeEventText))
  const titleVectors = await embedEventTexts(extractor, adaptedArticles.map((article) => article.title || ''))
  console.log(`[dedupe] Embedded ${vectors.length * 2} representation(s) in ${((performance.now() - embeddingStarted) / 1000).toFixed(2)}s`)

  const v2Result = clusterItemsV2(adaptedArticles, vectors, {
    titleVectors,
    semanticThreshold: args.semanticThreshold,
    highConfidenceThreshold: args.highConfidenceThreshold,
    maxPairHours: args.maxPairHours,
    topK: args.topK,
    protectSameSource: false,
    skipOutsideTimeWindowPairs: true,
  })
  const dedupeResult = buildArticleDuplicateGroups(articles, v2Result, {
    maxPairHours: args.maxPairHours,
  })
  const duplicateGroups = dedupeResult.duplicateGroups
    .map((group) => ({
      ...group,
      articles: group.articles.sort((left, right) => left._sortKey - right._sortKey),
    }))
    .sort((left, right) => right.articles.length - left.articles.length)
  const articleIndexById = new Map(articles.map((article, index) => [article.id, index]))

  console.log(`[dedupe] Pair checks: ${v2Result.pairChecks}`)
  console.log(`[dedupe] Candidate pairs: ${dedupeResult.candidatePairs}`)
  console.log(`[dedupe] Destructive gates: title_semantic>=${dedupeResult.options.minTitleSemanticScore} shared_title_anchors>=${dedupeResult.options.minSharedTitleTokens} lexical>=${dedupeResult.options.minLexicalScore}`)
  console.log(`[dedupe] Editorial/supporting articles protected from semantic deletion: ${dedupeResult.preservedSupportingArticles}`)
  console.log(`[dedupe] Duplicate groups found: ${duplicateGroups.length}`)

  if (duplicateGroups.length === 0) {
    console.log('[dedupe] No duplicate groups detected.')
    return
  }

  let mergedGroups = 0
  let deletedArticles = 0
  const errors = []

  for (const groupResult of duplicateGroups) {
    const group = groupResult.articles
    const keeper = group[0]
    const duplicates = group.slice(1)
    const duplicateIds = duplicates.map((article) => article.id)

    console.log('')
    console.log(`[dedupe] Group ${mergedGroups + 1}: keep ${keeper.id.slice(0, 8)} (${new Date(keeper._sortKey).toISOString()})`)
    console.log(`          ${keeper.title}`)
    console.log(`          ${group.length} article(s) in cluster`)

    for (const duplicate of duplicates) {
      console.log(`          - remove ${duplicate.id.slice(0, 8)} (${new Date(duplicate._sortKey).toISOString()}) ${duplicate.title}`)
      const evidence = dedupeResult.pairEvidence(
        articleIndexById.get(keeper.id),
        articleIndexById.get(duplicate.id),
      )
      const decision = evidence.decision
      console.log(`            evidence=${evidence.mode} semantic=${decision?.semanticScore?.toFixed(4) || '-'} title=${decision?.titleSemanticScore?.toFixed(4) || '-'} lexical=${decision?.lexicalScore?.toFixed(3) || '-'} anchors=[${decision?.sharedTitleTokens?.join(', ') || ''}] reason=${decision?.reason || evidence.mode}`)
    }

    const updatePayload = duplicates.reduce((acc, duplicate) => {
      const merged = mergeArticleFields({ ...keeper, ...acc }, duplicate)
      return { ...acc, ...merged }
    }, {})

    if (args.apply) {
      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await db
          .from('articles')
          .update(updatePayload)
          .eq('id', keeper.id)

        if (updateError) {
          errors.push(`Failed to update keeper ${keeper.id}: ${updateError.message}`)
          continue
        }
      }

      const { error: deleteError } = await db
        .from('articles')
        .delete()
        .in('id', duplicateIds)

      if (deleteError) {
        errors.push(`Failed to delete duplicates for keeper ${keeper.id}: ${deleteError.message}`)
        continue
      }
    }

    mergedGroups += 1
    deletedArticles += duplicateIds.length
  }

  console.log('')
  if (args.apply) {
    console.log(`[dedupe] Done. Groups merged: ${mergedGroups}, articles deleted: ${deletedArticles}`)
    if (errors.length > 0) {
      console.log('[dedupe] Errors:')
      for (const errorMessage of errors) {
        console.log(`  - ${errorMessage}`)
      }
    }
  } else {
    console.log('[dedupe] Dry run only. Re-run with --apply to commit the deletions.')
  }
}

main().catch((err) => {
  console.error('[dedupe] Fatal error:', err)
  process.exit(1)
})
