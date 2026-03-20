import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const TMDB_TOKEN = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  'Content-Type': 'application/json',
}

async function searchShow(query: string): Promise<any | null> {
  const res = await fetch(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=pt-BR&page=1`,
    { headers }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0] ?? null
}

async function getNextEpisode(showId: number): Promise<any | null> {
  const res = await fetch(
    `${TMDB_BASE}/tv/${showId}?language=pt-BR`,
    { headers }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.next_episode_to_air ?? null
}

async function getShowDetails(showId: number): Promise<any | null> {
  const res = await fetch(
    `${TMDB_BASE}/tv/${showId}?language=pt-BR`,
    { headers }
  )
  if (!res.ok) return null
  return res.json()
}

const SKIP_KEYWORDS = [
  'valorant', 'league of legends', 'lol', 'tft', 'overwatch', 'cs2',
  'futebol', 'nba', 'f1', 'formula 1', 'esport', 'música', 'music',
  'política', 'economia', 'tecnologia', 'tech', 'ia', 'inteligência artificial',
  'mercado', 'crypto', 'bitcoin', 'notícias', 'news',
]

function isLikelyTVTopic(topic: string): boolean {
  const lower = topic.toLowerCase()
  return !SKIP_KEYWORDS.some(kw => lower.includes(kw))
}

export async function GET(req: NextRequest) {
  const topicsParam = req.nextUrl.searchParams.get('topics')
  if (!topicsParam) return NextResponse.json({ episodes: [] })

  const allTopics = topicsParam.split(',').map((t) => t.trim())
  // Only search topics that could plausibly be TV shows
  const topics = allTopics.filter(isLikelyTVTopic)
  if (topics.length === 0) return NextResponse.json({ episodes: [] })

  const results = await Promise.allSettled(
    topics.map(async (topic) => {
      const show = await searchShow(topic)
      if (!show) return null

      const details = await getShowDetails(show.id)
      const nextEp = details?.next_episode_to_air

      return {
        showId: show.id,
        showName: details?.name || show.name,
        posterPath: show.poster_path
          ? `https://image.tmdb.org/t/p/w92${show.poster_path}`
          : null,
        episode: nextEp
          ? `T${nextEp.season_number}E${nextEp.episode_number} — ${nextEp.name || 'Próximo episódio'}`
          : null,
        airDate: nextEp?.air_date ?? null,
        status: details?.status ?? null,
      }
    })
  )

  const episodes = results
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<any>).value)
    .filter((e) => e.episode !== null) // only shows with upcoming episodes

  return NextResponse.json({ episodes })
}
