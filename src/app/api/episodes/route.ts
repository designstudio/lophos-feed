import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const TMDB_TOKEN = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  'Content-Type': 'application/json',
}

// Topics that are clearly NOT TV shows — skip entirely
const SKIP_KEYWORDS = [
  'valorant', 'league of legends', 'lol', 'tft', 'overwatch', 'cs2', 'dota',
  'futebol', 'nba', 'nfl', 'f1', 'formula 1', 'esport', 'basquete', 'tênis',
  'política', 'economia', 'tecnologia', 'ia', 'inteligência artificial',
  'mercado', 'crypto', 'bitcoin', 'notícias', 'news',
  'música', 'music', 'álbum', 'album', 'cinema', 'filme', 'movie',
  'arte', 'design', 'foto', 'viagem', 'culinária', 'receita', 'saúde',
  'ciência', 'espaço', 'nasa', 'moda', 'fashion',
]

// Topics that are very likely TV shows (exact or known patterns)
const SERIES_HINTS = [
  'série', 'series', 'temporada', 'season', 'netflix', 'hbo', 'disney+',
  'apple tv', 'amazon prime', 'paramount', 'peacock', 'max',
]

function shouldSearchAsSeries(topic: string): boolean {
  const lower = topic.toLowerCase()

  // Definitely skip
  if (SKIP_KEYWORDS.some(kw => lower.includes(kw))) return false

  // Definitely include if it has a series hint
  if (SERIES_HINTS.some(kw => lower.includes(kw))) return true

  // For anything else: only search if it looks like a proper name
  // (2+ words, or capitalized compound name that doesn't match generic words)
  const words = lower.trim().split(/\s+/)

  // Single generic words like "música", "tech", "cinema" → skip
  // But multi-word proper names like "American Horror Story", "The Last of Us" → include
  if (words.length === 1 && lower.length < 12) return false

  return true
}

async function searchShow(query: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=pt-BR&page=1`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null

    // Validate: the show name must loosely match the search query
    // This prevents "Cinema" → returning a random Brazilian show called "Cinéma"
    const showName = (result.name || result.original_name || '').toLowerCase()
    const queryLower = query.toLowerCase()

    // Check if query words appear in the show name or vice versa
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
    const nameMatch = queryWords.some(w => showName.includes(w)) ||
      showName.includes(queryLower) ||
      queryLower.includes(showName.substring(0, 8))

    if (!nameMatch) return null

    return result
  } catch { return null }
}

async function getShowDetails(showId: number): Promise<any | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${showId}?language=pt-BR`, { headers })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const topicsParam = req.nextUrl.searchParams.get('topics')
  if (!topicsParam) return NextResponse.json({ episodes: [] })

  const allTopics = topicsParam.split(',').map(t => t.trim()).filter(Boolean)
  const topics = allTopics.filter(shouldSearchAsSeries)

  if (topics.length === 0) return NextResponse.json({ episodes: [] })

  const results = await Promise.allSettled(
    topics.map(async (topic) => {
      const show = await searchShow(topic)
      if (!show) return null

      const details = await getShowDetails(show.id)
      if (!details) return null

      const nextEp = details.next_episode_to_air
      const lastEp = details.last_episode_to_air
      const ep = nextEp ?? lastEp
      if (!ep) return null

      return {
        showId: show.id,
        showName: details.name || show.name,
        posterPath: show.poster_path
          ? `https://image.tmdb.org/t/p/w92${show.poster_path}`
          : null,
        episode: `T${ep.season_number}E${ep.episode_number} — ${ep.name || 'Próximo episódio'}`,
        airDate: ep.air_date ?? null,
        isNext: !!nextEp,
        status: details.status ?? null,
      }
    })
  )

  const episodes = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value)
    .filter((ep, idx, arr) => arr.findIndex(e => e.showId === ep.showId) === idx)
    .sort((a, b) => {
      if (a.isNext && !b.isNext) return -1
      if (!a.isNext && b.isNext) return 1
      return 0
    })

  return NextResponse.json({ episodes })
}
