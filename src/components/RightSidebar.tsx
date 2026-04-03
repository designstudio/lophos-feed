'use client'
import { useState, useEffect, useRef } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

/** Sobe na árvore até encontrar o primeiro ancestral com overflow-y: auto | scroll */
function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return null
}

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const asideRef = useRef<HTMLElement>(null)

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

    // Listen for cross-tab changes and same-tab custom event from Sidebar
    window.addEventListener('storage', handler)
    window.addEventListener('lophos_widgets_updated', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('lophos_widgets_updated', handler)
    }
  }, [])

  // ResizeObserver: quando a sidebar muda de altura (skeleton → conteúdo real,
  // widgets carregando de APIs externas), força o browser a recalcular o sticky.
  // Técnica: nudge síncrono de scrollTop (+1 / -1) — as duas atribuições ocorrem
  // no mesmo frame, então o browser não renderiza o estado intermediário.
  useEffect(() => {
    const aside = asideRef.current
    if (!aside) return

    const ro = new ResizeObserver(() => {
      const sc = findScrollContainer(aside)
      if (!sc) return
      const prev = sc.scrollTop
      sc.scrollTop = prev + 1
      sc.scrollTop = prev
    })

    ro.observe(aside)
    return () => ro.disconnect()
  }, [])

  // Widgets to render in saved order
  const widgetsToRender = order.filter(id => active.includes(id))

  return (
    <aside ref={asideRef} className="sidebar-sticky flex flex-col gap-4 py-6">
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
