'use client'
import { useState, useEffect } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed: string[] = JSON.parse(saved)
          // First item is always weather, rest is the ordered+active list
          setOrder(parsed.length > 0 ? parsed : DEFAULT_ORDER)
          setActive(parsed.length > 0 ? parsed : DEFAULT_ORDER)
        }
      } catch {}
    }

    handler()

    // Listen for changes from the settings modal
    window.addEventListener('storage', handler)
    // Also poll every 500ms for same-tab changes (storage event doesn't fire in same tab)
    const interval = setInterval(handler, 500)
    return () => {
      window.removeEventListener('storage', handler)
      clearInterval(interval)
    }
  }, [])

  // Widgets to render in saved order
  const widgetsToRender = order.filter(id => active.includes(id))
  const activeNonWeather = widgetsToRender.filter(id => id !== 'weather')

  return (
    <aside className="flex flex-col gap-4 py-6 sticky" style={{ top: '57px', maxHeight: 'calc(100vh - 57px)' }}>
      {widgetsToRender.map(id => {
        if (id === 'weather') return <WeatherWidget key="weather" />
        // Each smart widget renders only itself but has access to all topics
        return (
          <SmartWidgets
            key={id}
            topics={topics}
            activeWidgets={[id]}
          />
        )
      })}
    </aside>
  )
}
