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

  // Debug para verificar se o scroll está funcionando
  useEffect(() => {
    const handleScroll = () => {
      console.log('Scroll position:', window.scrollY)
      const sidebar = document.getElementById(sidebarId)
      if (sidebar) {
        console.log('Sidebar element:', sidebar)
        console.log('Sidebar styles:', {
          position: getComputedStyle(sidebar).position,
          top: getComputedStyle(sidebar).top,
          display: getComputedStyle(sidebar).display,
          visibility: getComputedStyle(sidebar).visibility,
          opacity: getComputedStyle(sidebar).opacity
        })
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Update when widgets change
  useEffect(() => {
    if (mountedRef.current) {
      // Pequeno delay para garantir que DOM foi atualizado
      const timer = setTimeout(() => {
        // Trigger reflow se necessário
        const sidebar = document.getElementById(sidebarId)
        if (sidebar) {
          sidebar.style.display = 'none'
          sidebar.offsetHeight // Force reflow
          sidebar.style.display = ''
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
        id={sidebarId} 
        className="sidebar"
        style={{
          position: 'sticky',
          top: '81px',
          width: '336px',
          height: 'fit-content',
          zIndex: 10,
          backgroundColor: 'var(--color-bg-primary)'
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
