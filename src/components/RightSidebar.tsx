'use client'
import { useEffect, useRef, useState } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const mountedRef = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [stickyTop, setStickyTop] = useState(80)

  // Mark as mounted after initial render
  useEffect(() => {
    mountedRef.current = true
  }, [])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const TOP_OFFSET = 80
    const BOTTOM_OFFSET = 24
    const DESKTOP_BREAKPOINT = 1024

    const updateStickyTop = () => {
      if (window.innerWidth < DESKTOP_BREAKPOINT) {
        setStickyTop(TOP_OFFSET)
        return
      }

      const sidebarHeight = content.offsetHeight
      const viewportHeight = window.innerHeight
      const nextTop = Math.min(TOP_OFFSET, viewportHeight - sidebarHeight - BOTTOM_OFFSET)
      setStickyTop(nextTop)
    }

    const resizeObserver = new ResizeObserver(updateStickyTop)
    resizeObserver.observe(content)
    window.addEventListener('resize', updateStickyTop)
    updateStickyTop()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateStickyTop)
    }
  }, [order, active, topics])

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

  // Widgets to render in saved order
  const widgetsToRender = order.filter(id => active.includes(id))

  return (
    <aside className="sidebar-right hidden lg:block">
      <div className="sidebar">
        <div
          ref={contentRef}
          className="sidebar__inner sidebar__inner--sticky flex flex-col gap-4 py-6"
          style={{ top: `${stickyTop}px` }}
        >
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
        </div>
      </div>
    </aside>
  )
}
