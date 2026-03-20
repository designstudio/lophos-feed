'use client'
import { useState, useEffect } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'
import { Unread } from '@solar-icons/react-perf/Linear'
import { IconClose, IconPlus } from '@/components/icons'

const AVAILABLE_WIDGETS = [
  { id: 'weather', label: 'Clima', always: true },
  { id: 'valorant', label: 'Partidas — Valorant', topicKey: 'valorant' },
  { id: 'lol', label: 'Partidas — League of Legends', topicKey: 'league of legends' },
  { id: 'tft', label: 'Partidas — TFT', topicKey: 'tft' },
  { id: 'series', label: 'Próximos episódios', topicKey: 'series' },
]

const STORAGE_KEY = 'lophos_widgets'

const SPORT_ESPORT_KEYWORDS = [
  'valorant', 'league of legends', 'lol', 'tft', 'teamfight',
  'futebol', 'nba', 'formula 1', 'f1', 'nfl', 'cs2', 'csgo',
  'dota', 'overwatch', 'fortnite', 'esport', 'esports',
  'futebol americano', 'basquete', 'tênis', 'vôlei', 'natação',
]

function topicMatchesWidget(topics: string[], widgetId: string): boolean {
  const lower = topics.map((t) => t.toLowerCase())
  if (widgetId === 'valorant') return lower.some((t) => t.includes('valorant'))
  if (widgetId === 'lol') return lower.some((t) => t.includes('league') || t === 'lol')
  if (widgetId === 'tft') return lower.some((t) => t.includes('tft') || t.includes('teamfight'))
  if (widgetId === 'series') {
    // Show if any topic is NOT a known sport/esport/news topic
    // This way "American Horror Story", "Severance", any show name will match
    return lower.some((t) => !SPORT_ESPORT_KEYWORDS.some((kw) => t.includes(kw)))
  }
  return false
}

export function RightSidebar({ topics }: { topics: string[] }) {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(['weather'])
  const [showPicker, setShowPicker] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Load from localStorage, then auto-activate relevant widgets
  useEffect(() => {
    if (topics.length === 0) return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const base: string[] = saved ? JSON.parse(saved) : ['weather']

      // Auto-add widgets that match user topics but aren't saved yet
      const autoAdded = AVAILABLE_WIDGETS
        .filter((w) => !w.always && !base.includes(w.id) && topicMatchesWidget(topics, w.id))
        .map((w) => w.id)

      const merged = [...new Set([...base, ...autoAdded])]

      if (autoAdded.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      }

      setActiveWidgets(merged)
    } catch {}

    setInitialized(true)
  }, [topics.join(',')])

  const toggleWidget = (id: string) => {
    if (id === 'weather') return
    setActiveWidgets((prev) => {
      const next = prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const lowerTopics = topics.map((t) => t.toLowerCase())
  const relevantWidgets = AVAILABLE_WIDGETS.filter((w) => {
    if (w.always) return true
    return topicMatchesWidget(topics, w.id)
  })

  const hasAddable = relevantWidgets.some((w) => !w.always && !activeWidgets.includes(w.id))

  return (
    <aside className="flex flex-col gap-4 py-6 h-full">
      <WeatherWidget />

      {initialized && activeWidgets.filter((w) => w !== 'weather').length > 0 && (
        <SmartWidgets topics={topics} activeWidgets={activeWidgets} />
      )}

      {(hasAddable || activeWidgets.length > 1) && (
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors px-1"
          >
            <IconPlus size={13} />
            Gerenciar widgets
          </button>

          {showPicker && (
            <div className="absolute top-7 left-0 w-64 bg-white rounded-2xl border border-border shadow-lg z-50 p-3">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-2 px-1">
                Widgets disponíveis
              </p>
              {relevantWidgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => !w.always && toggleWidget(w.id)}
                  disabled={w.always}
                  className="flex items-center justify-between w-full px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-[13px] text-ink-primary">{w.label}</span>
                  {(w.always || activeWidgets.includes(w.id)) && (
                    <Unread size={13} className="text-accent flex-shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary px-2 py-1 transition-colors"
                >
                  <IconClose size={12} /> Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
