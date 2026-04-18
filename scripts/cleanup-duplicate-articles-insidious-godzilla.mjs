import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import {
  canonicalizeUrl,
  normalizeText,
  strongIntersection,
  textOverlapScore,
} from './news-pipeline-core.mjs'

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

function foldText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => foldText(item).trim())
    .filter(Boolean)
}

function parseArgs(argv) {
  const args = {
    days: 3,
    threshold: 0.28,
    minStrongTokens: 2,
    apply: false,
    limit: 5000,
    groups: [],
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

    if (arg.startsWith('--threshold=')) {
      args.threshold = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--threshold' && argv[i + 1]) {
      args.threshold = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg.startsWith('--min-strong=')) {
      args.minStrongTokens = Number(arg.split('=')[1])
      continue
    }
    if (arg === '--min-strong' && argv[i + 1]) {
      args.minStrongTokens = Number(argv[i + 1])
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

    if (arg.startsWith('--groups=')) {
      args.groups = parseCsvList(arg.split('=')[1])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      continue
    }
    if (arg === '--groups' && argv[i + 1]) {
      args.groups = parseCsvList(argv[i + 1])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      i += 1
      continue
    }
  }

  return args
}

function articleDate(article) {
  const candidates = [article.published_at, article.cached_at]
  for (const value of candidates) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (!Number.isNaN(time)) return time
  }
  return 0
}

function articleText(article) {
  const sectionsText = Array.isArray(article.sections)
    ? article.sections.map((section) => `${section?.heading || ''} ${section?.body || ''}`).join(' ')
    : ''

  return [article.title, article.summary, sectionsText].filter(Boolean).join(' ').trim()
}

function articleSignalText(article) {
  return foldText(articleText(article))
}

function titleText(article) {
  return normalizeText(article.title || '')
}

function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
}

function coreTitleText(title) {
  const noise = new Set([
    'novo',
    'nova',
    'novos',
    'novas',
    'trailer',
    'teaser',
    'sinopse',
    'data',
    'lança',
    'lanca',
    'lançamento',
    'lancamento',
    'estreia',
    'anuncia',
    'anunciado',
    'anunciada',
    'anunci',
    'confirma',
    'divulga',
    'apresenta',
    'mostra',
    'revela',
    'revelado',
    'revelada',
    'ganha',
    'ganham',
    'primeiro',
    'primeira',
    'segundo',
    'segunda',
  ])

  return tokenize(title)
    .filter((token) => !noise.has(token))
    .join(' ')
}

function intersectionCount(left, right) {
  const leftSet = new Set(tokenize(left))
  const rightSet = new Set(tokenize(right))
  let count = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) count += 1
  }
  return count
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
  const mergedSourceIds = uniqueIds([...(keeper.source_ids || []), ...(duplicate.source_ids || [])])
  const mergedKeywords = normalizeList([...(keeper.keywords || []), ...(duplicate.keywords || [])])
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

function isFranchiseArticle(article) {
  const haystack = articleSignalText(article)
  const godzillaSignals = [
    'godzilla',
    'kaiju',
    'monsterverse',
    'monster verse',
    'minus one',
    'minus zero',
    'takashi yamazaki',
    'yamazaki',
    'toho',
  ]
  const insidiousSignals = [
    'insidious',
    'the further',
    'out of the further',
    'lin shaye',
    'patrick wilson',
    'james wan',
  ]
  return godzillaSignals.some((signal) => haystack.includes(foldText(signal))) ||
    insidiousSignals.some((signal) => haystack.includes(foldText(signal)))
}

function isDuplicatePair(left, right, threshold, minStrongTokens) {
  const sameTitle = left._normalizedTitle && left._normalizedTitle === right._normalizedTitle
  const titleContains =
    left._normalizedTitle &&
    right._normalizedTitle &&
    (left._normalizedTitle.includes(right._normalizedTitle) ||
      right._normalizedTitle.includes(left._normalizedTitle))

  const titleScore = textOverlapScore(left._titleText, right._titleText)
  const coreScore = textOverlapScore(left._coreTitleText, right._coreTitleText)
  const titleShared = intersectionCount(left._titleText, right._titleText)
  const coreShared = intersectionCount(left._coreTitleText, right._coreTitleText)

  const bodyScore = textOverlapScore(left._text, right._text)
  const strong = strongIntersection(left._text, right._text)

  const headlineMatch =
    sameTitle ||
    titleContains ||
    (titleScore >= threshold && titleShared >= 2) ||
    (coreScore >= Math.max(0.22, threshold - 0.05) && coreShared >= 2) ||
    (titleShared >= 3 && titleScore >= 0.4) ||
    (coreShared >= 3 && coreScore >= 0.3)

  const bodyMatch = bodyScore >= Math.max(0.18, threshold - 0.08) && strong.length >= Math.min(minStrongTokens, 2)
  const supportMatch = headlineMatch && (bodyMatch || strong.length >= 2 || titleScore >= 0.5)

  return supportMatch || bodyMatch
}

async function main() {
  bootstrapEnv()

  const args = parseArgs(process.argv.slice(2))
  const db = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const since = new Date()
  since.setDate(since.getDate() - args.days)
  const sinceIso = since.toISOString()

  console.log(`[dedupe] Loading articles from the last ${args.days} day(s)...`)
  console.log(`[dedupe] Cutoff: ${sinceIso}`)

  const { data: rows, error } = await db
    .from('articles')
    .select('id, topic, title, summary, sections, sources, source_ids, keywords, matched_topics, image_url, video_url, published_at, cached_at')
    .or(`published_at.gte.${sinceIso},cached_at.gte.${sinceIso}`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('cached_at', { ascending: false, nullsFirst: false })
    .limit(args.limit)

  if (error) throw new Error(`Failed to load articles: ${error.message}`)

  const articles = (rows || [])
    .map((article) => ({
      ...article,
      _sortKey: articleDate(article),
      _text: articleText(article),
      _titleText: titleText(article),
      _coreTitleText: coreTitleText(article.title || ''),
      _normalizedTitle: normalizeText(article.title),
    }))
    .filter((article) => article._sortKey >= since.getTime())
    .filter((article) => isFranchiseArticle(article))
    .sort((a, b) => b._sortKey - a._sortKey)

  console.log(`[dedupe] Loaded ${articles.length} recent article(s) matching Godzilla/Insidious`)

  if (articles.length < 2) {
    console.log('[dedupe] Nothing to merge.')
    return
  }

  const parent = Array.from({ length: articles.length }, (_, index) => index)
  const find = (index) => {
    let root = index
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]]
      root = parent[root]
    }
    return root
  }
  const union = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  let pairChecks = 0
  for (let i = 0; i < articles.length; i += 1) {
    for (let j = i + 1; j < articles.length; j += 1) {
      pairChecks += 1
      const left = articles[i]
      const right = articles[j]

      if (isDuplicatePair(left, right, args.threshold, args.minStrongTokens)) {
        union(i, j)
      }
    }
  }

  const groups = new Map()
  for (let i = 0; i < articles.length; i += 1) {
    const root = find(i)
    const bucket = groups.get(root) || []
    bucket.push(articles[i])
    groups.set(root, bucket)
  }

  const duplicateGroups = Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => a._sortKey - b._sortKey))
    .sort((a, b) => b.length - a.length)

  console.log(`[dedupe] Pair checks: ${pairChecks}`)
  console.log(`[dedupe] Duplicate groups found: ${duplicateGroups.length}`)

  if (duplicateGroups.length === 0) {
    console.log('[dedupe] No duplicate groups detected.')
    return
  }

  let mergedGroups = 0
  let deletedArticles = 0
  const errors = []

  for (const [groupIndex, group] of duplicateGroups.entries()) {
    const groupNumber = groupIndex + 1
    if (args.apply && Array.isArray(args.groups) && args.groups.length > 0 && !args.groups.includes(groupNumber)) {
      continue
    }

    const keeper = group[0]
    const duplicates = group.slice(1)
    const duplicateIds = duplicates.map((article) => article.id)

    console.log('')
    console.log(`[dedupe] Group ${groupNumber}: keep ${keeper.id.slice(0, 8)} (${new Date(keeper._sortKey).toISOString()})`)
    console.log(`          ${keeper.title}`)
    console.log(`          ${group.length} article(s) in cluster`)

    for (const duplicate of duplicates) {
      console.log(`          - remove ${duplicate.id.slice(0, 8)} (${new Date(duplicate._sortKey).toISOString()}) ${duplicate.title}`)
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
    console.log('[dedupe] To apply only selected groups, use: --apply --groups 1,3')
  }
}

main().catch((err) => {
  console.error('[dedupe] Fatal error:', err)
  process.exit(1)
})
