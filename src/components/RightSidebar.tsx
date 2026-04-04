'use client'
import { useEffect, useState } from 'react'
import { WeatherWidget } from './WeatherWidget'
import { SmartWidgets } from './SmartWidgets'
import { useStickySidebarV2 } from '@/hooks/useStickySidebarV2'

const STORAGE_KEY = 'lophos_widgets'

const DEFAULT_ORDER = ['weather', 'valorant', 'lol', 'series']

export function RightSidebar({
  topics,
}: {
  topics: string[]
}) {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER)
  const [active, setActive] = useState<string[]>(['weather', 'valorant', 'lol', 'series'])
  const [stickyEnabled, setStickyEnabled] = useState(false)
  const { reinitializeStickySidebar, updateStickySidebar, destroyStickySidebar } = useStickySidebarV2({
    sidebarSelector: '#right-sidebar-sticky',
    containerSelector: '#feed-main-content',
    scrollContainer: '#feed-scroll-container',
    topSpacing: 80,
    bottomSpacing: 24,
    minWidth: 1024,
    disabled: !stickyEnabled,
  })

  useEffect(() => {
    if (!stickyEnabled) return

    const raf = window.requestAnimationFrame(() => {
      reinitializeStickySidebar()
    })

    return () => window.cancelAnimationFrame(raf)
  }, [reinitializeStickySidebar, order, active, topics, stickyEnabled])

  useEffect(() => {
    const onLoad = () => updateStickySidebar()
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [updateStickySidebar])

  useEffect(() => {
    const scrollContainer = document.getElementById('feed-scroll-container')
    if (!scrollContainer) return

    const syncStickyMode = () => {
      const shouldEnable = scrollContainer.scrollTop > 8
      setStickyEnabled(shouldEnable)

      if (!shouldEnable) {
        destroyStickySidebar()
      }
    }

    syncStickyMode()
    scrollContainer.addEventListener('scroll', syncStickyMode, { passive: true })

    return () => {
      scrollContainer.removeEventListener('scroll', syncStickyMode)
    }
  }, [destroyStickySidebar])

  useEffect(() => {
    if (!stickyEnabled) return

    let frame1 = 0
    let frame2 = 0
    let timeoutIds: number[] = []

    const syncStickyAfterLayoutShift = () => {
      if (frame1) window.cancelAnimationFrame(frame1)
      if (frame2) window.cancelAnimationFrame(frame2)
      timeoutIds.forEach(id => window.clearTimeout(id))
      timeoutIds = []

      frame1 = window.requestAnimationFrame(() => {
        frame2 = window.requestAnimationFrame(() => {
          reinitializeStickySidebar()

          // Sidebar esquerda agora anima largura por ~280ms.
          // Atualizamos no início, no meio e no fim para o sticky
          // acompanhar o layout sem precisar esperar scroll.
          timeoutIds = [
            window.setTimeout(() => {
              updateStickySidebar()
            }, 40),
            window.setTimeout(() => {
              reinitializeStickySidebar()
            }, 180),
            window.setTimeout(() => {
              reinitializeStickySidebar()
              updateStickySidebar()
            }, 320),
          ]
        })
      })
    }

    window.addEventListener('sidebar:toggle', syncStickyAfterLayoutShift)
    window.addEventListener('resize', syncStickyAfterLayoutShift)

    return () => {
      if (frame1) window.cancelAnimationFrame(frame1)
      if (frame2) window.cancelAnimationFrame(frame2)
      timeoutIds.forEach(id => window.clearTimeout(id))
      window.removeEventListener('sidebar:toggle', syncStickyAfterLayoutShift)
      window.removeEventListener('resize', syncStickyAfterLayoutShift)
    }
  }, [reinitializeStickySidebar, updateStickySidebar, stickyEnabled])

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
    <aside id="right-sidebar-sticky" className="sidebar-right hidden lg:block">
      <div className="sidebar">
        <div className="sidebar__inner flex flex-col gap-4 pt-6 pb-6">
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
