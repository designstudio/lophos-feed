'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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
    containerSelector: '.feed-layout', // O wrapper alto que contém feed + sidebar
    scrollContainer: '.flex-1.overflow-y-auto', // O scroller interno
    topSpacing: 81, // Offset ajustado (81px = 5.063rem)
    bottomSpacing: 24, // Espaçamento inferior
    innerWrapperSelector: '.sidebar__inner', // Wrapper interno do conteúdo
    minWidth: 1024, // Só ativar em desktop (lg breakpoint)
    disabled: false // Habilitar por enquanto
  })

  // Update sticky sidebar when widgets change (height changes)
  useEffect(() => {
    if (mountedRef.current) {
      // Pequeno delay para garantir que DOM foi atualizado
      const timer = setTimeout(() => {
        updateStickySidebar()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [order, active, topics, updateStickySidebar])

  // Fires updateSticky at multiple points to cover the 220ms width transition
  const scheduleStickyUpdate = useCallback(() => {
    // rAF×2: first paint after state change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.log('[StickySidebar] updateSticky — rAF×2')
        updateStickySidebar()
      })
    })
    // 50ms: mid-transition
    setTimeout(() => {
      console.log('[StickySidebar] updateSticky — 50ms')
      updateStickySidebar()
    }, 50)
    // 250ms: after transition (220ms) settles
    setTimeout(() => {
      console.log('[StickySidebar] updateSticky — 250ms')
      updateStickySidebar()
    }, 250)
  }, [updateStickySidebar])

  // Update sticky sidebar when left sidebar opens/closes (width transition = 220ms)
  useEffect(() => {
    const handleSidebarToggle = () => {
      scheduleStickyUpdate()

      // Also fire on transitionend of the sidebar <aside> (width property)
      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === 'width' && (e.target as HTMLElement)?.tagName === 'ASIDE') {
          console.log('[StickySidebar] updateSticky — transitionend')
          updateStickySidebar()
          document.removeEventListener('transitionend', handleTransitionEnd)
        }
      }
      document.addEventListener('transitionend', handleTransitionEnd)
      // Safety cleanup in case transitionend never fires
      setTimeout(() => document.removeEventListener('transitionend', handleTransitionEnd), 500)
    }

    window.addEventListener('sidebar:toggle', handleSidebarToggle)
    return () => window.removeEventListener('sidebar:toggle', handleSidebarToggle)
  }, [scheduleStickyUpdate, updateStickySidebar])

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
