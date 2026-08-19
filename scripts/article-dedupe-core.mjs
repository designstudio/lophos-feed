import { normalizeText } from './news-pipeline-core.mjs'
import { SOURCE_ROLES, classifyEditorialSource } from './news-cluster-v2-core.mjs'

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`
}

function articleTime(article) {
  for (const value of [article?.published_at, article?.cached_at]) {
    const parsed = Date.parse(value || '')
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function adaptArticleForV2(article) {
  const primarySource = Array.isArray(article?.sources) ? article.sources[0] : null
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    topic: article.topic,
    pub_date: article.published_at || article.cached_at,
    fetched_at: article.cached_at || article.published_at,
    source_name: primarySource?.name || '',
    source_url: primarySource?.url || '',
    url: primarySource?.url || '',
  }
}

function exactTitleMatch(left, right, decision, maxPairHours) {
  const leftTitle = normalizeText(left?.title)
  const rightTitle = normalizeText(right?.title)
  if (!leftTitle || leftTitle.length < 12 || leftTitle !== rightTitle) return false

  const leftTime = articleTime(left)
  const rightTime = articleTime(right)
  const hoursApart = leftTime === null || rightTime === null
    ? decision?.hoursApart ?? null
    : Math.abs(leftTime - rightTime) / 3_600_000

  if (hoursApart !== null && hoursApart > maxPairHours) return false
  if (decision?.conflictingTitleYears || decision?.conflictingTitleEventKinds) return false
  return true
}

function semanticMatch(leftIndex, rightIndex, sourceProfiles, decision, options) {
  return sourceProfiles[leftIndex]?.role === SOURCE_ROLES.PRIMARY &&
    sourceProfiles[rightIndex]?.role === SOURCE_ROLES.PRIMARY &&
    Boolean(decision?.merge) &&
    (decision?.titleSemanticScore ?? 0) >= options.minTitleSemanticScore &&
    (decision?.sharedTitleTokens?.length ?? 0) >= options.minSharedTitleTokens &&
    (decision?.lexicalScore ?? 0) >= options.minLexicalScore
}

/**
 * Builds destructive-dedupe groups from V2 pair decisions.
 *
 * V2 semantic edges are restricted to hard-news articles. Editorial/supporting
 * articles (reviews, analysis and roundups) are preserved unless their normalized
 * headlines are exactly equal. Complete-link prevents A~B and B~C from deleting C
 * when A and C are not independently compatible.
 */
export function buildArticleDuplicateGroups(articles, v2Result, options = {}) {
  const maxPairHours = options.maxPairHours ?? v2Result?.options?.maxPairHours ?? 18
  const dedupeOptions = {
    minTitleSemanticScore: options.minTitleSemanticScore ?? 0.93,
    minSharedTitleTokens: options.minSharedTitleTokens ?? 2,
    minLexicalScore: options.minLexicalScore ?? 0.12,
  }
  const items = articles.map(adaptArticleForV2)
  const sourceProfiles = items.map(classifyEditorialSource)
  const decisions = v2Result?.pairDecisions || new Map()
  const candidatePairKeys = v2Result?.candidatePairKeys || new Set()

  const pairEvidence = (left, right) => {
    const key = pairKey(left, right)
    const decision = decisions.get(key)
    if (exactTitleMatch(articles[left], articles[right], decision, maxPairHours)) {
      return { match: true, mode: 'exact-title', decision }
    }
    if (semanticMatch(left, right, sourceProfiles, decision, dedupeOptions)) {
      return { match: true, mode: 'semantic-v2', decision }
    }
    return { match: false, mode: null, decision }
  }

  const seedEdges = []
  for (let left = 0; left < articles.length; left += 1) {
    for (let right = left + 1; right < articles.length; right += 1) {
      const evidence = pairEvidence(left, right)
      if (!evidence.match) continue
      if (evidence.mode !== 'exact-title' && !candidatePairKeys.has(pairKey(left, right))) continue
      seedEdges.push({
        left,
        right,
        ...evidence,
        confidence: evidence.mode === 'exact-title' ? 2 : evidence.decision?.semanticScore || 0,
      })
    }
  }
  seedEdges.sort((left, right) => right.confidence - left.confidence)

  let clusters = articles.map((_, index) => [index])
  const acceptedEdges = []
  for (const edge of seedEdges) {
    const leftClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.left))
    const rightClusterIndex = clusters.findIndex((cluster) => cluster.includes(edge.right))
    if (leftClusterIndex === rightClusterIndex) continue

    const leftCluster = clusters[leftClusterIndex]
    const rightCluster = clusters[rightClusterIndex]
    const completeLinkPass = leftCluster.every((left) =>
      rightCluster.every((right) => pairEvidence(left, right).match),
    )
    if (!completeLinkPass) continue

    clusters = clusters.filter((_, index) => index !== leftClusterIndex && index !== rightClusterIndex)
    clusters.push([...leftCluster, ...rightCluster])
    acceptedEdges.push(edge)
  }

  const duplicateGroups = clusters
    .filter((members) => members.length > 1)
    .map((members) => ({
      articles: members.map((index) => articles[index]),
      memberIndices: members,
      evidence: acceptedEdges.filter((edge) => members.includes(edge.left) && members.includes(edge.right)),
    }))

  return {
    duplicateGroups,
    sourceProfiles,
    pairEvidence,
    candidatePairs: seedEdges.length,
    preservedSupportingArticles: sourceProfiles.filter((profile) => profile.role === SOURCE_ROLES.SUPPORTING).length,
    options: { maxPairHours, ...dedupeOptions },
  }
}
