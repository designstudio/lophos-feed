'use client'
import { useState, useEffect, useRef } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const sidebarId = 'right-sidebar'
  const mountedRef = useRef(false)

  // Simple sticky positioning that works
  useEffect(() => {
    const sidebar = document.getElementById(sidebarId)
    if (!sidebar) return

    const handleScroll = () => {
      const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement
      if (!scrollContainer) return

      const scrollTop = scrollContainer.scrollTop
      const sidebarTop = 81
      const sidebarHeight = sidebar.offsetHeight
      const containerHeight = scrollContainer.offsetHeight

      // Calculate when sidebar should stop
      const maxScroll = scrollContainer.scrollHeight - containerHeight
      const stopPosition = maxScroll - sidebarHeight + sidebarTop

      if (scrollTop > sidebarTop && scrollTop < stopPosition) {
        // Fixed positioning
        sidebar.style.position = 'fixed'
        sidebar.style.top = `${sidebarTop}px`
        sidebar.style.width = '336px'
      } else if (scrollTop >= stopPosition) {
        // Absolute at bottom
        sidebar.style.position = 'absolute'
        sidebar.style.top = `${stopPosition}px`
        sidebar.style.width = '336px'
      } else {
        // Static at top
        sidebar.style.position = 'static'
        sidebar.style.width = '336px'
      }
    }

    const scrollContainer = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll() // Initial call
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [])

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
