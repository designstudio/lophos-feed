'use client'
import { useState, useEffect } from 'react'
import { Trophy, Tv, Calendar } from 'lucide-react'

interface Match {
  team1: string
  team2: string
  date: string
  tournament: string
  game: string
}

interface SeriesEpisode {
  show: string
  episode: string
  airDate: string
}

// Map topics to widget types
const ESPORTS_TOPICS: Record<string, string> = {
  'valorant': 'valorant',
  'league of legends': 'lol',
  'lol': 'lol',
  'tft': 'tft',
  'teamfight tactics': 'tft',
  'esports': 'esports',
}

const SERIES_TOPICS = [
  'american horror story', 'ahs', 'séries', 'series', 'netflix', 'hbo',
  'disney', 'streaming', 'tv', 'shows'
]

// Static upcoming matches data (would be fetched from an API in production)
const UPCOMING_MATCHES: Record<string, Match[]> = {
  valorant: [
    { team1: 'Sentinels', team2: 'LOUD', date: 'Hoje 18:00', tournament: 'VCT Americas', game: 'Valorant' },
    { team1: 'FNATIC', team2: 'Team Liquid', date: 'Amanhã 14:00', tournament: 'VCT EMEA', game: 'Valorant' },
  ],
  lol: [
    { team1: 'T1', team2: 'Gen.G', date: 'Hoje 20:00', tournament: 'LCK', game: 'LoL' },
    { team1: 'G2', team2: 'Fnatic', date: 'Amanhã 17:00', tournament: 'LEC', game: 'LoL' },
  ],
  tft: [
    { team1: 'Qualifier', team2: 'Top 8', date: 'Sáb 15:00', tournament: "Tactician's Crown", game: 'TFT' },
  ],
  esports: [
    { team1: 'LOUD', team2: 'paiN', date: 'Hoje 19:00', tournament: 'CBLoL', game: 'Esports' },
  ],
}

const UPCOMING_EPISODES: SeriesEpisode[] = [
  { show: 'American Horror Story', episode: 'S13E01 — Estreia da temporada', airDate: 'Out 31, 2026' },
  { show: 'The Last of Us', episode: 'S02E03', airDate: 'Esta semana' },
  { show: 'House of the Dragon', episode: 'S03E01', airDate: 'Em breve' },
]

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-ink-primary truncate">
          {match.team1} <span className="text-ink-muted font-normal">vs</span> {match.team2}
        </p>
        <p className="text-[10px] text-ink-tertiary mt-0.5">{match.tournament}</p>
      </div>
      <span className="text-[10px] text-accent font-medium ml-2 flex-shrink-0">{match.date}</span>
    </div>
  )
}

function EpisodeCard({ ep }: { ep: SeriesEpisode }) {
  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <p className="text-[12px] font-medium text-ink-primary">{ep.show}</p>
      <p className="text-[11px] text-ink-secondary mt-0.5">{ep.episode}</p>
      <p className="text-[10px] text-ink-tertiary mt-0.5">{ep.airDate}</p>
    </div>
  )
}

export function SmartWidgets({ topics }: { topics: string[] }) {
  const lowerTopics = topics.map((t) => t.toLowerCase())

  // Detect which esports are relevant
  const esportGames = new Set<string>()
  lowerTopics.forEach((t) => {
    Object.entries(ESPORTS_TOPICS).forEach(([key, game]) => {
      if (t.includes(key)) esportGames.add(game)
    })
  })

  // Detect series interest
  const hasSeries = lowerTopics.some((t) => SERIES_TOPICS.some((s) => t.includes(s)))

  // Collect matches
  const matches: Match[] = []
  esportGames.forEach((game) => {
    if (UPCOMING_MATCHES[game]) matches.push(...UPCOMING_MATCHES[game])
  })

  if (matches.length === 0 && !hasSeries) return null

  return (
    <>
      {matches.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={13} className="text-amber-500" />
            <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider">Próximas partidas</h3>
          </div>
          {matches.slice(0, 4).map((m, i) => <MatchCard key={i} match={m} />)}
        </div>
      )}

      {hasSeries && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tv size={13} className="text-purple-500" />
            <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider">Próximos episódios</h3>
          </div>
          {UPCOMING_EPISODES.slice(0, 3).map((ep, i) => <EpisodeCard key={i} ep={ep} />)}
        </div>
      )}
    </>
  )
}
