'use client'
import { useState, useEffect, useRef } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'
import { useStickySidebarV2 } from '@/hooks/useStickySidebarV2'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const sidebarId = 'right-sidebar'
  const mountedRef = useRef(false)

  // Setup sticky sidebar v2
  const { updateStickySidebar } = useStickySidebarV2({
    sidebarSelector: `#${sidebarId}`,
    containerSelector: '.feed-layout',
    topSpacing: 81,
    bottomSpacing: 24,
    innerWrapperSelector: '.sidebar__inner',
    minWidth: 1024,
    disabled: false
  })

  // Update sticky sidebar when widgets change
  useEffect(() => {
    if (mountedRef.current) {
      const timer = setTimeout(() => updateStickySidebar(), 100)
      return () => clearTimeout(timer)
    }
  }, [order, active, topics, updateStickySidebar])

  // Sidebar esquerda não tem mais transition:width — o layout muda em 1 frame.
  // Um único rAF é suficiente para updateSticky() pegar as medidas finais.
  useEffect(() => {
    const handleSidebarToggle = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('[StickySidebar] updateSticky — sidebar toggle')
          updateStickySidebar()
        })
      })
    }
    window.addEventListener('sidebar:toggle', handleSidebarToggle)
    return () => window.removeEventListener('sidebar:toggle', handleSidebarToggle)
  }, [updateStickySidebar])

  // Mark as mounted after initial render
  useEffect(() => {
    mountedRef.current = true
  }, [])

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
    <div className="sidebar-right hidden lg:block">
      <div id={sidebarId} className="sidebar">
        <div className="sidebar__inner flex flex-col gap-4 py-6">
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
    </div>
  )
}
