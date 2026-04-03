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
  const rafRef = useRef<number | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transitionCleanupRef = useRef<(() => void) | null>(null)

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

  // Coalesced: cancels any pending updates before scheduling new ones.
  // Happy path: rAF×2 + transitionend [+ idle] = max 3 calls.
  // Fallback path (no transitionend): rAF×2 + 280ms = 2 calls.
  const scheduleStickyUpdate = useCallback(() => {
    // Cancel pending
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (fallbackTimerRef.current !== null) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null }
    if (transitionCleanupRef.current) { transitionCleanupRef.current(); transitionCleanupRef.current = null }

    // 1. rAF×2: first clean frame after layout change
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        console.log('[StickySidebar] updateSticky — rAF×2')
        updateStickySidebar()
        rafRef.current = null
      })
    })

    // Attach transitionend directly to the animating <aside> (e.target === el guard)
    const asideEl = document.querySelector('aside')
    if (asideEl) {
      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.target === asideEl && e.propertyName === 'width') {
          console.log('[StickySidebar] updateSticky — transitionend')
          updateStickySidebar()
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => updateStickySidebar())
          }
          cleanup()
        }
      }
      const cleanup = () => {
        asideEl.removeEventListener('transitionend', onTransitionEnd)
        if (fallbackTimerRef.current !== null) { clearTimeout(fallbackTimerRef.current); fallbackTimerRef.current = null }
        transitionCleanupRef.current = null
      }
      transitionCleanupRef.current = cleanup
      asideEl.addEventListener('transitionend', onTransitionEnd)

      // 2. 280ms fallback: fires only if transitionend never arrives
      fallbackTimerRef.current = setTimeout(() => {
        console.log('[StickySidebar] updateSticky — 280ms fallback')
        updateStickySidebar()
        cleanup()
      }, 280)
    }
  }, [updateStickySidebar])

  // Update sticky sidebar when left sidebar opens/closes (width transition = 220ms)
  useEffect(() => {
    const handleSidebarToggle = () => scheduleStickyUpdate()
    window.addEventListener('sidebar:toggle', handleSidebarToggle)
    return () => window.removeEventListener('sidebar:toggle', handleSidebarToggle)
  }, [scheduleStickyUpdate])

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
