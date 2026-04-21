const NORMALIZE_RE = /[\u0300-\u036f]/g

const TOPIC_KEYWORDS: Record<string, string[]> = {
  valorant: [
    'valorant',
    'vct',
    'valorant champions',
    'valorant masters',
    'valorant challengers',
  ],
  'league of legends': [
    'league of legends',
    'lolesports',
    'league of legends esports',
    'summoners rift',
    'worlds',
    'lec',
    'lck',
    'lcs',
  ],
  lol: [
    'league of legends',
    'lolesports',
    'league of legends esports',
    'summoners rift',
    'worlds',
    'lec',
    'lck',
    'lcs',
  ],
  tft: [
    'teamfight tactics',
    'tft',
  ],
  overwatch: [
    'overwatch',
    'overwatch 2',
    'owl',
    'owcs',
  ],
  'e-sports': [
    'esports',
    'e-sports',
    'competitive gaming',
    'vct',
    'owl',
    'owcs',
    'lolesports',
  ],
  games: [
    'game',
    'games',
    'gaming',
    'videogame',
    'videogames',
    'video game',
    'jogo',
    'jogos',
  ],
}

const BROAD_TOPIC_FALLBACKS = new Set(['games', 'e-sports', 'esports'])
const NARROW_TOPIC_FALLBACKS = new Set([
  'valorant',
  'league of legends',
  'lol',
  'tft',
  'overwatch',
])

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(NORMALIZE_RE, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreTopic(topic: string, text: string): number {
  const normalizedTopic = normalizeText(topic)
  const keywords = TOPIC_KEYWORDS[normalizedTopic] || []
  let score = 0

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) continue

    const pattern = normalizedKeyword.includes(' ')
      ? new RegExp(`\\b${normalizedKeyword.replace(/\s+/g, '\\s+')}\\b`, 'i')
      : new RegExp(`\\b${normalizedKeyword}\\b`, 'i')

    if (pattern.test(text)) {
      score++
    }
  }

  return score
}

function isBroadTopic(topic: string): boolean {
  return BROAD_TOPIC_FALLBACKS.has(normalizeText(topic))
}

function isNarrowTopic(topic: string): boolean {
  return NARROW_TOPIC_FALLBACKS.has(normalizeText(topic))
}

export function inferRssTopic({
  feedTopics = [],
  title = '',
  description = '',
  sourceName = '',
}: {
  feedTopics?: string[]
  title?: string
  description?: string
  sourceName?: string
}): string {
  const cleanedTopics = Array.from(
    new Set((feedTopics || []).map((topic) => String(topic || '').trim()).filter(Boolean)),
  )

  if (cleanedTopics.length === 0) return 'geral'

  const haystack = normalizeText([title, description, sourceName].filter(Boolean).join(' '))
  if (cleanedTopics.length === 1) {
    const onlyTopic = cleanedTopics[0]
    const onlyScore = scoreTopic(onlyTopic, haystack)

    if (onlyScore > 0 || !isNarrowTopic(onlyTopic)) {
      return onlyTopic
    }

    if (/\b(esports?|gaming|game|games|jogo|jogos|vct|owl|owcs|lolesports)\b/i.test(haystack)) {
      return cleanedTopics.find((topic) => /e-?sports|games?/i.test(topic)) || 'games'
    }

    return 'games'
  }

  const scoredTopics = cleanedTopics
    .map((topic) => ({ topic, score: scoreTopic(topic, haystack) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (isBroadTopic(a.topic) ? 1 : -1))

  if (scoredTopics.length > 0) {
    return scoredTopics[0].topic
  }

  const broadFallback = cleanedTopics.find((topic) => isBroadTopic(topic))
  if (broadFallback) return broadFallback

  const gamingContext = /\b(esports?|gaming|game|games|jogo|jogos|vct|owl|owcs|lolesports)\b/i.test(haystack)
  if (gamingContext) {
    return cleanedTopics.find((topic) => /e-?sports|games?/i.test(topic)) || cleanedTopics[0]
  }

  return cleanedTopics[0]
}
