'use client'
import { useState, useEffect } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'
import { Plus, Close, Check } from '@solar-icons/react-perf/Linear'

const AVAILABLE_WIDGETS = [
  { id: 'weather', label: 'Clima', always: true },
  { id: 'valorant', label: 'Partidas — Valorant', topic: 'valorant' },
  { id: 'lol', label: 'Partidas — League of Legends', topic: 'league of legends' },
  { id: 'tft', label: 'Partidas — TFT', topic: 'tft' },
  { id: 'series', label: 'Próximos episódios', topic: 'series' },
]

const STORAGE_KEY = 'lophos_widgets'

export function RightSidebar({ topics }: { topics: string[] }) {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(['weather'])
  const [showPicker, setShowPicker] = useState(false)

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setActiveWidgets(JSON.parse(saved))
    } catch {}
  }, [])

  const toggleWidget = (id: string) => {
    if (id === 'weather') return // always on
    setActiveWidgets((prev) => {
      const next = prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  // Filter available widgets based on user topics
  const lowerTopics = topics.map((t) => t.toLowerCase())
  const relevantWidgets = AVAILABLE_WIDGETS.filter((w) => {
    if (w.always) return true
    if (!w.topic) return true
    return lowerTopics.some((t) => t.includes(w.topic!))
  })

  // Only show add button if there are relevant widgets not yet active
  const hasAddable = relevantWidgets.some((w) => !w.always && !activeWidgets.includes(w.id))

  return (
    <aside className="flex flex-col gap-4 py-6 h-full">
      {/* Weather always shown */}
      <WeatherWidget />

      {/* Active non-weather widgets */}
      {activeWidgets.filter((w) => w !== 'weather').length > 0 && (
        <SmartWidgets
          topics={topics}
          activeWidgets={activeWidgets}
        />
      )}

      {/* Add widget button */}
      {(hasAddable || activeWidgets.length > 1) && (
        <div className="relative">
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 text-[12px] text-ink-tertiary hover:text-ink-secondary transition-colors px-1"
          >
            <Plus size={13} />
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
                    <Check size={13} className="text-accent flex-shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={() => setShowPicker(false)}
                  className="flex items-center gap-1.5 text-[12px] text-ink-tertiary hover:text-ink-secondary px-2 py-1 transition-colors"
                >
                  <Close size={12} /> Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
