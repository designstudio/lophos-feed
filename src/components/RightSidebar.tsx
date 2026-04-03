'use client'
import { useState, useEffect, useRef } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'
import { useSmartStickySidebar } from '@/hooks/useSmartStickySidebar'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({ topics }: { topics: string[] }) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const asideRef = useRef<HTMLElement>(null)

  // Create ref objects from the state for the hook
  const scrollerRef = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  scrollerRef.current = scroller
  containerRef.current = container

  // Find the scroll container (flex-1.overflow-y-auto) and the flex wrapper
  useEffect(() => {
    const findElements = () => {
      if (asideRef.current) {
        // Find scroller
        const foundScroller = asideRef.current.closest('.flex-1.overflow-y-auto') as HTMLElement
        if (foundScroller) {
          setScroller(foundScroller)
        }

        // Find the flex.gap-10 wrapper (parent of both columns)
        const flexWrapper = asideRef.current.closest('.flex.gap-10') as HTMLDivElement
        if (flexWrapper) {
          setContainer(flexWrapper)
        }
      }
    }

    findElements()
    
    // Also try after a delay in case DOM isn't ready
    const timer = setTimeout(findElements, 100)
    return () => clearTimeout(timer)
  }, [])

  // Setup smart sticky behavior
  useSmartStickySidebar({
    scrollerRef,
    sidebarRef: asideRef,
    containerRef,
    topOffset: 56
  })

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
    <div ref={containerRef} className="sidebar-right hidden lg:block">
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
    </div>
  )
}
