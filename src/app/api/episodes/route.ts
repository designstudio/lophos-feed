import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const TMDB_TOKEN = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  'Content-Type': 'application/json',
}

// Topics that are clearly NOT TV shows — skip them
const SKIP_KEYWORDS = [
  'valorant', 'league of legends', 'lol', 'tft', 'cs2', 'dota',
  'futebol', 'nba', 'nfl', 'f1', 'formula 1', 'esport',
  'política', 'economia', 'tecnologia', 'ia', 'inteligência artificial',
  'mercado', 'crypto', 'bitcoin', 'notícias',
]

function isLikelyTVTopic(topic: string): boolean {
  const lower = topic.toLowerCase()
  return !SKIP_KEYWORDS.some(kw => lower.includes(kw))
}

async function searchShow(query: string): Promise<any | null> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=pt-BR&page=1`,
      { headers }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Only return if it's a reasonable match (not just any random show)
    return data.results?.[0] ?? null
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
  const topics = allTopics.filter(isLikelyTVTopic)

  if (topics.length === 0) return NextResponse.json({ episodes: [] })

  const results = await Promise.allSettled(
    topics.map(async (topic) => {
      const show = await searchShow(topic)
      if (!show) return null

      const details = await getShowDetails(show.id)
      if (!details) return null

      const nextEp = details.next_episode_to_air
      const lastEp = details.last_episode_to_air

      // Prefer next episode; fall back to last aired episode
      const ep = nextEp ?? lastEp
      if (!ep) return null

      const isNext = !!nextEp

      return {
        showId: show.id,
        showName: details.name || show.name,
        posterPath: show.poster_path
          ? `https://image.tmdb.org/t/p/w92${show.poster_path}`
          : null,
        episode: `T${ep.season_number}E${ep.episode_number} — ${ep.name || (isNext ? 'Próximo episódio' : 'Último episódio')}`,
        airDate: ep.air_date ?? null,
        isNext,
        status: details.status ?? null,
      }
    })
  )

  const episodes = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value)
    // Deduplicate by showId
    .filter((ep, idx, arr) => arr.findIndex(e => e.showId === ep.showId) === idx)
    // Sort: upcoming first, then most recent
    .sort((a, b) => {
      if (a.isNext && !b.isNext) return -1
      if (!a.isNext && b.isNext) return 1
      return 0
    })

  return NextResponse.json({ episodes })
}
