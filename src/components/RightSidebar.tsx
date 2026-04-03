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
  const sidebarRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)

  // Sticky positioning simples como o Medium
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const handleScroll = () => {
      const scrollTop = window.scrollY
      const sidebarTop = 81 // Offset do header
      
      if (scrollTop > sidebarTop) {
        sidebar.style.position = 'fixed'
        sidebar.style.top = `${sidebarTop}px`
      } else {
        sidebar.style.position = 'static'
        sidebar.style.top = 'auto'
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Update when widgets change
  useEffect(() => {
    if (mountedRef.current) {
      // Pequeno delay para garantir que DOM foi atualizado
      const timer = setTimeout(() => {
        // Trigger reflow se necessário
        if (sidebarRef.current) {
          sidebarRef.current.style.display = 'none'
          sidebarRef.current.offsetHeight // Force reflow
          sidebarRef.current.style.display = ''
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [order, active, topics])

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
      <div 
        ref={sidebarRef}
        id={sidebarId} 
        className="sidebar"
        style={{
          position: 'sticky',
          top: '81px',
          width: '336px'
        }}
      >
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
