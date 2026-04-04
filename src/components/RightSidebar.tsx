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

    let timeoutIds: number[] = []

    const syncStickyAfterLayoutShift = () => {
      timeoutIds.forEach(id => window.clearTimeout(id))
      timeoutIds = []

      // Evita "pulinhos" horizontais durante a animação da sidebar esquerda:
      // desmonta o sticky no início e monta novamente só quando a largura assentou.
      destroyStickySidebar()

      timeoutIds = [
        window.setTimeout(() => {
          reinitializeStickySidebar()
        }, 320),
        window.setTimeout(() => {
          updateStickySidebar()
        }, 380),
      ]
    }

    window.addEventListener('sidebar:toggle', syncStickyAfterLayoutShift)
    window.addEventListener('resize', syncStickyAfterLayoutShift)

    return () => {
      timeoutIds.forEach(id => window.clearTimeout(id))
      window.removeEventListener('sidebar:toggle', syncStickyAfterLayoutShift)
      window.removeEventListener('resize', syncStickyAfterLayoutShift)
    }
  }, [destroyStickySidebar, reinitializeStickySidebar, updateStickySidebar, stickyEnabled])

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
