import {
  formatInterestTopicLabel,
  getCustomInterestTopicSearchTerm,
  getInterestTopicLabel,
} from '@/lib/default-interest-topics'

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '')
}

export function getCatalogSearchTerm(value: string): string {
  return getCustomInterestTopicSearchTerm(value).trim().slice(0, 80)
}

export function getCanonicalTopicSuggestion(query: string, catalogTopics: string[]): string {
  const knownLabel = getInterestTopicLabel(query)
  if (knownLabel !== query.trim()) return knownLabel

  const queryToken = normalizeToken(query)
  if (!queryToken) return formatInterestTopicLabel(query)

  const tokenCounts = new Map<string, { count: number; value: string }>()
  for (const topic of catalogTopics) {
    const uniqueTokens = new Set(topic.split(/\s+/).map((token) => token.trim()).filter(Boolean))
    for (const token of uniqueTokens) {
      const normalized = normalizeToken(token)
      if (!normalized || (!normalized.includes(queryToken) && !queryToken.includes(normalized))) continue
      const current = tokenCounts.get(normalized)
      tokenCounts.set(normalized, { count: (current?.count ?? 0) + 1, value: token })
    }
  }

  const bestToken = [...tokenCounts.values()]
    .sort((left, right) => right.count - left.count || left.value.length - right.value.length)[0]?.value

  return formatInterestTopicLabel(bestToken ?? query)
}

export async function expandMatchedTopicCatalogFilters(db: any, topics: string[]): Promise<string[]> {
  const cleanedTopics = [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))]
  if (cleanedTopics.length === 0) return []

  const searchTerms = [...new Set(
    cleanedTopics
      .map(getCatalogSearchTerm)
      .map((term) => term.toLocaleLowerCase('pt-BR'))
      .filter(Boolean),
  )]

  const results = await Promise.all(searchTerms.map(async (searchTerm) => {

    const { data, error } = await db
      .from('matched_topic_catalog')
      .select('topic')
      .ilike('topic', `%${escapeLikePattern(searchTerm)}%`)
      .gt('article_count', 0)
      .limit(500)

    if (error) {
      console.error(`[matched-topic-catalog] Failed to expand "${searchTerm}":`, error)
      return []
    }

    return (data ?? []).map((row: any) => String(row.topic ?? '').trim()).filter(Boolean)
  }))

  return [...new Set([...cleanedTopics, ...results.flat()])]
}
