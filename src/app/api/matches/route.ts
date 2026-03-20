import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const PANDASCORE_KEY = process.env.PANDASCORE_API_KEY!

const GAME_SLUGS: Record<string, string> = {
  valorant: 'valorant',
  lol: 'league-of-legends',
  tft: 'league-of-legends', // TFT usa mesmo endpoint do LOL no PandaScore
}

async function fetchUpcomingMatches(game: string) {
  const slug = GAME_SLUGS[game]
  if (!slug) return []

  const url = new URL(`https://api.pandascore.co/${slug}/matches/upcoming`)
  url.searchParams.set('per_page', '3')
  url.searchParams.set('sort', 'begin_at')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${PANDASCORE_KEY}` },
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!res.ok) {
    console.error(`PandaScore error for ${game}: ${res.status}`)
    return []
  }

  const data = await res.json()
  return (data || []).map((m: any) => ({
    id: m.id,
    team1: m.opponents?.[0]?.opponent?.name ?? 'TBD',
    team1Logo: m.opponents?.[0]?.opponent?.image_url ?? null,
    team2: m.opponents?.[1]?.opponent?.name ?? 'TBD',
    team2Logo: m.opponents?.[1]?.opponent?.image_url ?? null,
    tournament: m.league?.name ?? m.serie?.full_name ?? '',
    beginAt: m.begin_at,
    game,
  }))
}

export async function GET(req: NextRequest) {
  const games = req.nextUrl.searchParams.get('games')?.split(',') || ['valorant', 'lol']

  const results = await Promise.allSettled(
    games.map((g) => fetchUpcomingMatches(g))
  )

  const matches: Record<string, any[]> = {}
  games.forEach((g, i) => {
    matches[g] = results[i].status === 'fulfilled' ? results[i].value : []
  })

  return NextResponse.json({ matches })
}
