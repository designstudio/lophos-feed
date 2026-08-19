export type InterestTopicCategory = {
  label: string
  aliases: readonly string[]
}

export const INTEREST_TOPIC_CATEGORIES = [
  { label: 'Tecnologia', aliases: ['tecnologia', 'Tecnologia'] },
  { label: 'Anime', aliases: ['anime'] },
  { label: 'Música', aliases: ['music', 'música'] },
  { label: 'Horror', aliases: ['horror'] },
  { label: 'Livros', aliases: ['books'] },
  { label: 'Economia', aliases: ['economia'] },
  { label: 'Games', aliases: ['games', 'valorant', 'Games'] },
  { label: 'Filmes e Séries', aliases: ['movies', 'cinema', 'Cinema'] },
  { label: 'Educação', aliases: ['educacao'] },
  { label: 'Brasil', aliases: ['brasil', 'Brasil'] },
  { label: 'Mundo', aliases: ['mundo'] },
  { label: 'Ciência', aliases: ['ciencia'] },
  { label: 'Carros', aliases: ['carros'] },
  { label: 'Cultura', aliases: ['cultura'] },
  { label: 'Turismo', aliases: ['turismo'] },
  { label: 'Carnaval', aliases: ['carnaval'] },
  { label: 'Empreendedorismo', aliases: ['empreendedorismo'] },
  { label: 'Reviews', aliases: ['reviews'] },
] as const satisfies readonly InterestTopicCategory[]

export const DEFAULT_INTEREST_TOPICS = INTEREST_TOPIC_CATEGORIES.map(({ label }) => label)

function normalizeTopicLookupKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const categoryByTopicKey = new Map<string, InterestTopicCategory>()

for (const category of INTEREST_TOPIC_CATEGORIES) {
  for (const value of [category.label, ...category.aliases]) {
    categoryByTopicKey.set(normalizeTopicLookupKey(value), category)
  }
}

export function getInterestTopicLabel(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  return categoryByTopicKey.get(normalizeTopicLookupKey(trimmedValue))?.label ?? trimmedValue
}

export function toInterestTopicLabels(values: string[]): string[] {
  const labels = values.map(getInterestTopicLabel).filter(Boolean)
  return [...new Set(labels)]
}

export type InterestTopicFilters = {
  articleTopics: string[]
  matchedTopics: string[]
}

export function getInterestTopicFilters(values: string[]): InterestTopicFilters {
  const articleTopics: string[] = []
  const matchedTopics: string[] = []

  for (const value of values) {
    const trimmedValue = value.trim()
    if (!trimmedValue) continue

    const category = categoryByTopicKey.get(normalizeTopicLookupKey(trimmedValue))
    if (category) {
      articleTopics.push(category.label, ...category.aliases)
    } else {
      matchedTopics.push(trimmedValue, trimmedValue.toLocaleLowerCase('pt-BR'))
    }
  }

  return {
    articleTopics: [...new Set(articleTopics)],
    matchedTopics: [...new Set(matchedTopics)],
  }
}

export function getMatchingInterestTopicLabel(
  articleTopic: string,
  matchedTopics: string[],
  selectedTopics: string[],
): string | undefined {
  const articleTopicKey = normalizeTopicLookupKey(articleTopic)
  const matchedTopicKeys = new Set(matchedTopics.map(normalizeTopicLookupKey).filter(Boolean))

  return selectedTopics.find((selectedTopic) => {
    const category = categoryByTopicKey.get(normalizeTopicLookupKey(selectedTopic))
    if (category) {
      return [category.label, ...category.aliases]
        .some((candidate) => articleTopicKey === normalizeTopicLookupKey(candidate))
    }
    return matchedTopicKeys.has(normalizeTopicLookupKey(selectedTopic))
  })
}
