import {
  formatInterestTopicLabel,
  getCustomInterestTopicSearchTerm,
  getInterestTopicLabel,
} from '@/lib/default-interest-topics'

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function getCatalogSearchTerm(value: string): string {
  return getCustomInterestTopicSearchTerm(value).trim().slice(0, 80)
}

type CatalogTopic = {
  topic: string
  article_count: number
}

function normalizeTopicPhrase(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

export function getCanonicalTopicSuggestions(query: string, catalogTopics: CatalogTopic[]): string[] {
  const trimmedQuery = query.trim()
  const canonicalLabel = formatInterestTopicLabel(getInterestTopicLabel(trimmedQuery))
  if (!canonicalLabel) return []

  const queryKey = normalizeTopicPhrase(trimmedQuery)
  const canonicalKey = normalizeTopicPhrase(canonicalLabel)

  // Explicit aliases such as "lgbt" are intentionally represented only by
  // their umbrella label instead of leaking every editorial keyword.
  if (queryKey !== canonicalKey) return [canonicalLabel]

  const hasExactCatalogTopic = catalogTopics.some(({ topic }) =>
    normalizeTopicPhrase(topic) === queryKey,
  )
  if (hasExactCatalogTopic) return [canonicalLabel]

  const childSuggestions = catalogTopics
    .filter(({ topic, article_count }) =>
      article_count >= 2 && normalizeTopicPhrase(topic).startsWith(`${queryKey} `),
    )
    .map(({ topic }) => formatInterestTopicLabel(topic))

  return [...new Set([canonicalLabel, ...childSuggestions])].slice(0, 8)
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
