'use client'
import { useState, useEffect } from 'react'
import { Tv } from '@solar-icons/react-perf/Linear'
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
  tft: { label: 'TFT', logo: 'https://www.google.com/s2/favicons?domain=teamfighttactics.leagueoflegends.com&sz=32' },
}

const ESPORTS_MAP: Record<string, string> = {
  'valorant': 'valorant', 'league of legends': 'lol', 'lol': 'lol',
  'tft': 'tft', 'teamfight tactics': 'tft',
}

const SERIES_KEYWORDS = [
  'american horror story', 'ahs', 'série', 'series', 'netflix', 'hbo',
  'disney', 'streaming', 'tv', 'show', 'temporada', 'episódio',
  'the last of us', 'house of the dragon', 'stranger things', 'severance',
  'the bear', 'andor', 'white lotus', 'yellowstone', 'succession',
]

function isSeriesTopic(topic: string): boolean {
  const lower = topic.toLowerCase()
  return SERIES_KEYWORDS.some((kw) => lower.includes(kw))
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
  if (!logo) return <span className="w-4 h-4 rounded-full bg-bg-tertiary flex-shrink-0 inline-block" />
  return <img src={logo} alt={name} width={16} height={16} className="rounded-full flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
  const seriesTopics = topics.filter((t) => isSeriesTopic(t))

  useEffect(() => {
    if (activeGames.length === 0) return
    setLoadingMatches(true)
    fetch(`/api/matches?games=${activeGames.join(',')}`)
      .then((r) => r.json())
      .then((data) => { setMatchesByGame(data.matches || {}); setLoadingMatches(false) })
      .catch(() => setLoadingMatches(false))
  }, [activeWidgets.join(','), topics.join(',')])

  useEffect(() => {
    if (!showSeries || seriesTopics.length === 0) { setEpisodes([]); return }
    setLoadingEpisodes(true)
    fetch(`/api/episodes?topics=${seriesTopics.map(encodeURIComponent).join(',')}`)
      .then((r) => r.json())
      .then((data) => { setEpisodes(data.episodes || []); setLoadingEpisodes(false) })
      .catch(() => setLoadingEpisodes(false))
  }, [showSeries, seriesTopics.join(',')])

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
            {loadingMatches && <div className="space-y-2"><div className="skeleton h-8 rounded" /><div className="skeleton h-8 rounded" /></div>}
            {!loadingMatches && matches.length === 0 && <p className="text-[12px] text-ink-tertiary">Nenhuma partida agendada.</p>}
            {!loadingMatches && matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-primary flex-wrap">
                    <TeamLogo logo={m.team1Logo} name={m.team1} />
                    <span>{m.team1}</span>
                    <span className="text-ink-muted font-normal text-[11px]">vs</span>
                    <TeamLogo logo={m.team2Logo} name={m.team2} />
                    <span>{m.team2}</span>
                  </div>
                  <p className="text-[10px] text-ink-tertiary mt-0.5">{m.tournament}</p>
                </div>
                <span className="text-[10px] text-accent font-medium ml-2 flex-shrink-0">{formatMatchDate(m.beginAt)}</span>
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
          {loadingEpisodes && <div className="space-y-2"><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /></div>}
          {!loadingEpisodes && episodes.length === 0 && (
            <p className="text-[12px] text-ink-tertiary">
              {seriesTopics.length === 0 ? 'Adicione séries nos seus tópicos para ver episódios.' : 'Nenhum episódio próximo encontrado.'}
            </p>
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
                <p className="text-[12px] font-medium text-ink-primary leading-tight">{ep.showName}</p>
                <p className="text-[11px] text-ink-secondary mt-0.5">{ep.episode}</p>
                <p className="text-[10px] text-accent mt-0.5">{formatAirDate(ep.airDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
