'use client'
import { useState, useEffect } from 'react'
import { Tv } from '@solar-icons/react-perf/Linear'
import { formatDistanceToNow, format, isToday, isTomorrow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Match {
  id: number
  team1: string
  team1Logo: string | null
  team2: string
  team2Logo: string | null
  tournament: string
  beginAt: string
  game: string
}

interface SeriesEpisode {
  show: string
  episode: string
  airDate: string
}

const GAME_META: Record<string, { label: string; logo: string; color: string }> = {
  valorant: {
    label: 'Valorant',
    logo: 'https://www.google.com/s2/favicons?domain=playvalorant.com&sz=32',
    color: 'text-red-500',
  },
  lol: {
    label: 'League of Legends',
    logo: 'https://www.google.com/s2/favicons?domain=leagueoflegends.com&sz=32',
    color: 'text-blue-500',
  },
  tft: {
    label: 'TFT',
    logo: 'https://www.google.com/s2/favicons?domain=teamfighttactics.leagueoflegends.com&sz=32',
    color: 'text-purple-500',
  },
}

const UPCOMING_EPISODES: SeriesEpisode[] = [
  { show: 'American Horror Story', episode: 'S13E01 — Estreia', airDate: 'Out 31, 2026' },
  { show: 'The Last of Us', episode: 'S02E03', airDate: 'Esta semana' },
  { show: 'House of the Dragon', episode: 'S03E01', airDate: 'Em breve' },
]

const ESPORTS_MAP: Record<string, string> = {
  'valorant': 'valorant',
  'league of legends': 'lol',
  'lol': 'lol',
  'tft': 'tft',
  'teamfight tactics': 'tft',
}

const SERIES_KEYWORDS = ['american horror story', 'ahs', 'séries', 'series', 'netflix', 'hbo', 'disney', 'streaming', 'tv', 'shows']

function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return `Hoje ${format(date, 'HH:mm')}`
  if (isTomorrow(date)) return `Amanhã ${format(date, 'HH:mm')}`
  return format(date, "dd/MM HH:mm", { locale: ptBR })
}

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  if (!logo) return <span className="w-4 h-4 rounded-full bg-bg-tertiary flex-shrink-0 inline-block" />
  return (
    <img
      src={logo}
      alt={name}
      width={16}
      height={16}
      className="rounded-full flex-shrink-0"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

interface Props {
  topics: string[]
  activeWidgets: string[]
}

export function SmartWidgets({ topics, activeWidgets }: Props) {
  const lowerTopics = topics.map((t) => t.toLowerCase())
  const [matchesByGame, setMatchesByGame] = useState<Record<string, Match[]>>({})
  const [loading, setLoading] = useState(true)

  // Detect active game widgets
  const activeGames = [...new Set(
    Object.entries(ESPORTS_MAP)
      .filter(([key, gameId]) =>
        activeWidgets.includes(gameId) &&
        lowerTopics.some((t) => t.includes(key))
      )
      .map(([, gameId]) => gameId)
  )]

  const showSeries = activeWidgets.includes('series') &&
    lowerTopics.some((t) => SERIES_KEYWORDS.some((s) => t.includes(s)))

  useEffect(() => {
    if (activeGames.length === 0) { setLoading(false); return }

    fetch(`/api/matches?games=${activeGames.join(',')}`)
      .then((r) => r.json())
      .then((data) => {
        setMatchesByGame(data.matches || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activeWidgets.join(','), topics.join(',')])

  if (activeGames.length === 0 && !showSeries) return null

  return (
    <>
      {activeGames.map((gameId) => {
        const meta = GAME_META[gameId]
        if (!meta) return null
        const matches = matchesByGame[gameId] || []

        return (
          <div key={gameId} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <img src={meta.logo} alt={meta.label} width={14} height={14} className="rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <h3 className="text-[11px] font-semibold text-ink-primary uppercase tracking-wider">{meta.label}</h3>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="skeleton h-8 rounded" />
                <div className="skeleton h-8 rounded" />
              </div>
            )}

            {!loading && matches.length === 0 && (
              <p className="text-[12px] text-ink-tertiary">Nenhuma partida agendada.</p>
            )}

            {!loading && matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-primary">
                    <TeamLogo logo={m.team1Logo} name={m.team1} />
                    <span>{m.team1}</span>
                    <span className="text-ink-muted font-normal text-[11px]">vs</span>
                    <TeamLogo logo={m.team2Logo} name={m.team2} />
                    <span>{m.team2}</span>
                  </div>
                  <p className="text-[10px] text-ink-tertiary mt-0.5">{m.tournament}</p>
                </div>
                <span className="text-[10px] text-accent font-medium ml-2 flex-shrink-0">
                  {formatMatchDate(m.beginAt)}
                </span>
              </div>
            ))}
          </div>
        )
      })}

      {showSeries && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tv size={13} className="text-purple-500" />
            <h3 className="text-[11px] font-semibold text-ink-primary uppercase tracking-wider">Próximos episódios</h3>
          </div>
          {UPCOMING_EPISODES.map((ep, i) => (
            <div key={i} className="py-2.5 border-b border-border last:border-0">
              <p className="text-[12px] font-medium text-ink-primary">{ep.show}</p>
              <p className="text-[11px] text-ink-secondary mt-0.5">{ep.episode}</p>
              <p className="text-[10px] text-ink-tertiary mt-0.5">{ep.airDate}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
