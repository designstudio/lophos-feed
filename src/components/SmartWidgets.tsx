'use client'
import { useState, useEffect } from 'react'
import { Monitor02 as Tv } from '@untitledui/icons'
import { format, isToday, isTomorrow } from 'date-fns'
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

interface Episode {
  showId: number
  showName: string
  posterPath: string | null
  episode: string
  airDate: string | null
}

const GAME_META: Record<string, { label: string; logo: string }> = {
  valorant: { label: 'Valorant', logo: 'https://www.google.com/s2/favicons?domain=playvalorant.com&sz=32' },
  lol: { label: 'League of Legends', logo: 'https://www.google.com/s2/favicons?domain=leagueoflegends.com&sz=32' },
}

const ESPORTS_MAP: Record<string, string> = {
  'valorant': 'valorant', 'league of legends': 'lol', 'lol': 'lol',
}

function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return `Hoje ${format(date, 'HH:mm')}`
  if (isTomorrow(date)) return `Amanhã ${format(date, 'HH:mm')}`
  return format(date, 'dd/MM HH:mm', { locale: ptBR })
}

function formatAirDate(dateStr: string | null): string {
  if (!dateStr) return 'Em breve'
  const date = new Date(dateStr + 'T12:00:00')
  if (isToday(date)) return 'Hoje'
  if (isTomorrow(date)) return 'Amanhã'
  return format(date, "dd 'de' MMM", { locale: ptBR })
}

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  return (
    <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/70 dark:bg-bg-secondary">
      {logo ? (
        <img
          src={logo}
          alt={name}
          width={20}
          height={20}
          className="h-4 w-4 rounded-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : null}
    </span>
  )
}

interface Props { topics: string[]; activeWidgets: string[] }

export function SmartWidgets({ topics, activeWidgets }: Props) {
  const lowerTopics = topics.map((t) => t.toLowerCase())
  const [matchesByGame, setMatchesByGame] = useState<Record<string, Match[]>>({})
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  const activeGames = [...new Set(
    Object.entries(ESPORTS_MAP)
      .filter(([key, gameId]) => activeWidgets.includes(gameId) && lowerTopics.some((t) => t.includes(key)))
      .map(([, gameId]) => gameId)
  )]

  const showSeries = activeWidgets.includes('series')

  useEffect(() => {
    if (activeGames.length === 0) return
    setLoadingMatches(true)
    fetch(`/api/matches?games=${activeGames.join(',')}`)
      .then((r) => r.json())
      .then((data) => { setMatchesByGame(data.matches || {}); setLoadingMatches(false) })
      .catch(() => setLoadingMatches(false))
  }, [activeWidgets.join(','), topics.join(',')])

  useEffect(() => {
    if (!showSeries) { setEpisodes([]); return }
    // Use all topics — TMDB will find what matches as TV shows
    const topicsToSearch = topics.length > 0 ? topics : []
    if (topicsToSearch.length === 0) { setEpisodes([]); return }
    setLoadingEpisodes(true)
    fetch(`/api/episodes?topics=${topicsToSearch.map(encodeURIComponent).join(',')}`)
      .then((r) => r.json())
      .then((data) => { setEpisodes(data.episodes || []); setLoadingEpisodes(false) })
      .catch(() => setLoadingEpisodes(false))
  }, [showSeries, topics.join(',')])

  return (
    <>
      {activeGames.map((gameId) => {
        const meta = GAME_META[gameId]
        if (!meta) return null
        const matches = matchesByGame[gameId] || []
        return (
          <div key={gameId} className="rounded-2xl border border-border bg-bg-primary p-4">
            <div className="flex items-center gap-2 mb-3">
              <img src={meta.logo} alt={meta.label} width={16} height={16} className="rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <h3 className="text-[14px] font-semibold text-ink-primary tracking-wide">{meta.label}</h3>
            </div>
            {loadingMatches && <div className="space-y-2"><div className="skeleton h-8 rounded" /><div className="skeleton h-8 rounded" /></div>}
            {!loadingMatches && matches.length === 0 && <p className="text-[12px] text-ink-tertiary">Nenhuma partida agendada.</p>}
            {!loadingMatches && matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink-primary min-w-0">
                    <TeamLogo logo={m.team1Logo} name={m.team1} />
                    <span className="truncate max-w-[4.5rem]">{m.team1}</span>
                    <span className="text-ink-muted font-normal text-[11px] flex-shrink-0">vs</span>
                    <TeamLogo logo={m.team2Logo} name={m.team2} />
                    <span className="truncate max-w-[4.5rem]">{m.team2}</span>
                  </div>
                  <p className="text-[0.75rem] text-ink-tertiary mt-0.5">{m.tournament}</p>
                </div>
                <span className="text-[0.75rem] text-accent font-medium ml-2 flex-shrink-0">{formatMatchDate(m.beginAt)}</span>
              </div>
            ))}
          </div>
        )
      })}

      {showSeries && (
        <div className="rounded-2xl border border-border bg-bg-primary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tv size={16} className="text-purple-500" />
            <h3 className="text-[14px] font-semibold text-ink-primary tracking-wide">Minhas séries</h3>
          </div>
          {loadingEpisodes && <div className="space-y-2"><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /></div>}
          {!loadingEpisodes && episodes.length === 0 && (
            <p className="text-[12px] text-ink-tertiary">Nenhum episódio próximo encontrado.</p>
          )}
          {!loadingEpisodes && episodes.map((ep) => (
            <div key={ep.showId} className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
              {ep.posterPath && (
                <img src={ep.posterPath} alt={ep.showName} width={32} height={48}
                  className="rounded flex-shrink-0 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[0.875rem] font-medium text-ink-primary leading-tight truncate">{ep.showName}</p>
                <p className="text-[0.75rem] text-ink-secondary mt-0.5">{ep.episode}</p>
                <p className="text-[0.75rem] text-accent mt-0.5">{formatAirDate(ep.airDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
