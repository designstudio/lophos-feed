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
  { label: 'Games', aliases: ['games', 'Games'] },
  { label: 'Esports', aliases: ['esports', 'e-sports'] },
  { label: 'Filmes e Séries', aliases: ['movies', 'cinema', 'Cinema'] },
  { label: 'Educação', aliases: ['educacao'] },
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

const CUSTOM_INTEREST_TOPIC_ALIASES = [
  {
    label: 'LGBTQIAPN+',
    searchTerm: 'lgbt',
    aliases: ['lgbt', 'lgbt+', 'lgbtq', 'lgbtq+', 'lgbtqia', 'lgbtqia+', 'lgbtqiapn', 'lgbtqiapn+'],
  },
] as const

const customTopicByKey = new Map(
  CUSTOM_INTEREST_TOPIC_ALIASES.flatMap((topic) =>
    [topic.label, ...topic.aliases].map((value) => [normalizeTopicLookupKey(value), topic] as const),
  ),
)

for (const category of INTEREST_TOPIC_CATEGORIES) {
  for (const value of [category.label, ...category.aliases]) {
    categoryByTopicKey.set(normalizeTopicLookupKey(value), category)
  }
}

export function getInterestTopicLabel(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  const lookupKey = normalizeTopicLookupKey(trimmedValue)
  return categoryByTopicKey.get(lookupKey)?.label
    ?? customTopicByKey.get(lookupKey)?.label
    ?? trimmedValue
}

export function getCustomInterestTopicSearchTerm(value: string): string {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''
  return customTopicByKey.get(normalizeTopicLookupKey(trimmedValue))?.searchTerm ?? trimmedValue
}

const TOPIC_LOWERCASE_WORDS = new Set([
  'a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'o', 'of', 'os', 'para', 'the', 'and',
])

const TOPIC_WORD_CAPITALIZATION: Record<string, string> = {
  ai: 'AI',
  ia: 'IA',
  ios: 'iOS',
  ipad: 'iPad',
  iphone: 'iPhone',
  macbook: 'MacBook',
  nba: 'NBA',
  pc: 'PC',
  ps5: 'PS5',
  rpg: 'RPG',
  tft: 'TFT',
  valorant: 'Valorant',
  xbox: 'Xbox',
  'lgbtqiapn+': 'LGBTQIAPN+',
}

function capitalizeTopicWord(word: string): string {
  const normalizedWord = word.toLocaleLowerCase('pt-BR')
  const brandedWord = TOPIC_WORD_CAPITALIZATION[normalizedWord]
  if (brandedWord) return brandedWord
  return normalizedWord.charAt(0).toLocaleUpperCase('pt-BR') + normalizedWord.slice(1)
}

export function formatInterestTopicLabel(value: string): string {
  const label = getInterestTopicLabel(value)
  const words = label.split(/\s+/).filter(Boolean)

  return words.map((word, index) => {
    const normalizedWord = word.toLocaleLowerCase('pt-BR')
    if (index > 0 && index < words.length - 1 && TOPIC_LOWERCASE_WORDS.has(normalizedWord)) {
      return normalizedWord
    }
    return word.split('-').map(capitalizeTopicWord).join('-')
  }).join(' ')
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
      const label = getInterestTopicLabel(trimmedValue)
      const searchTerm = getCustomInterestTopicSearchTerm(label)
      matchedTopics.push(label, label.toLocaleLowerCase('pt-BR'), searchTerm.toLocaleLowerCase('pt-BR'))
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
    const selectedTopicKey = normalizeTopicLookupKey(getCustomInterestTopicSearchTerm(selectedTopic))
    return [...matchedTopicKeys].some((matchedTopicKey) =>
      matchedTopicKey === selectedTopicKey || matchedTopicKey.includes(selectedTopicKey),
    )
  })
}
