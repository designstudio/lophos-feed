'use client'
import { Trophy, Tv } from 'lucide-react'

interface Match {
  team1: string
  team2: string
  date: string
  tournament: string
}

interface SeriesEpisode {
  show: string
  episode: string
  airDate: string
}

const UPCOMING_MATCHES: Record<string, Match[]> = {
  valorant: [
    { team1: 'Sentinels', team2: 'LOUD', date: 'Hoje 18:00', tournament: 'VCT Americas' },
    { team1: 'FNATIC', team2: 'Team Liquid', date: 'Amanhã 14:00', tournament: 'VCT EMEA' },
  ],
  lol: [
    { team1: 'T1', team2: 'Gen.G', date: 'Hoje 20:00', tournament: 'LCK' },
    { team1: 'G2', team2: 'Fnatic', date: 'Amanhã 17:00', tournament: 'LEC' },
  ],
  tft: [
    { team1: 'Qualifier', team2: 'Top 8', date: 'Sáb 15:00', tournament: "Tactician's Crown" },
  ],
}

const UPCOMING_EPISODES: SeriesEpisode[] = [
  { show: 'American Horror Story', episode: 'S13E01 — Estreia', airDate: 'Out 31, 2026' },
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

interface Props {
  topics: string[]
  activeWidgets: string[]
}

export function SmartWidgets({ topics, activeWidgets }: Props) {
  const lowerTopics = topics.map((t) => t.toLowerCase())

  const showValorant = activeWidgets.includes('valorant')
  const showLoL = activeWidgets.includes('lol')
  const showTFT = activeWidgets.includes('tft')
  const showSeries = activeWidgets.includes('series')

  const matches: Match[] = [
    ...(showValorant ? UPCOMING_MATCHES.valorant : []),
    ...(showLoL ? UPCOMING_MATCHES.lol : []),
    ...(showTFT ? UPCOMING_MATCHES.tft : []),
  ]

  return (
    <>
      {matches.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={13} className="text-amber-500" />
            <h3 className="text-[11px] font-semibold text-ink-primary uppercase tracking-wider">
              Próximas partidas
            </h3>
          </div>
          {matches.map((m, i) => <MatchCard key={i} match={m} />)}
        </div>
      )}

      {showSeries && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tv size={13} className="text-purple-500" />
            <h3 className="text-[11px] font-semibold text-ink-primary uppercase tracking-wider">
              Próximos episódios
            </h3>
          </div>
          {UPCOMING_EPISODES.map((ep, i) => <EpisodeCard key={i} ep={ep} />)}
        </div>
      )}
    </>
  )
}
