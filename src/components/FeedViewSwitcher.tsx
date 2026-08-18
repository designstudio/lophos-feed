'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type FeedView = 'mosaic' | 'list'

const FEED_VIEW_STORAGE_KEY = 'lophos_feed_view'
const FEED_VIEW_CHANGE_EVENT = 'lophos:feed-view-change'

function readPreferredView(): FeedView {
  try {
    return localStorage.getItem(FEED_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'mosaic'
  } catch {
    return 'mosaic'
  }
}

function savePreferredView(view: FeedView) {
  try {
    localStorage.setItem(FEED_VIEW_STORAGE_KEY, view)
    window.dispatchEvent(new CustomEvent(FEED_VIEW_CHANGE_EVENT, { detail: view }))
  } catch {}
}

export function usePreferredFeedView() {
  const [view, setView] = useState<FeedView>('mosaic')

  useEffect(() => {
    const update = (event?: Event) => {
      const selected = event instanceof CustomEvent && (event.detail === 'list' || event.detail === 'mosaic')
        ? event.detail
        : readPreferredView()
      setView(selected)
    }

    update()
    window.addEventListener(FEED_VIEW_CHANGE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(FEED_VIEW_CHANGE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return view
}

export function FeedViewSwitcher({
  current,
  ariaLabel = 'Visualização do feed',
}: {
  current: FeedView
  ariaLabel?: string
}) {
  const pillRef = useRef<HTMLSpanElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<FeedView, HTMLButtonElement | null>>({
    mosaic: null,
    list: null,
  })
  const switchTimerRef = useRef<number | null>(null)
  const [visualView, setVisualView] = useState<FeedView>(current)
  const visualViewRef = useRef<FeedView>(current)
  visualViewRef.current = visualView

  const positionPill = useCallback((view: FeedView, animate: boolean) => {
    const pill = pillRef.current
    const tab = tabRefs.current[view]
    if (!pill || !tab) return

    if (!animate) pill.style.transition = 'none'
    pill.style.transform = `translateX(${tab.offsetLeft}px)`
    pill.style.width = `${tab.offsetWidth}px`

    if (!animate) {
      void pill.offsetWidth
      pill.style.removeProperty('transition')
    }
  }, [])

  useEffect(() => {
    setVisualView(current)
  }, [current])

  useLayoutEffect(() => {
    positionPill(visualView, visualView !== current)
  }, [current, positionPill, visualView])

  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return

    const reposition = () => positionPill(visualViewRef.current, false)
    const observer = new ResizeObserver(reposition)
    observer.observe(tabs)
    window.addEventListener('resize', reposition)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [positionPill])

  useEffect(() => () => {
    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current)
  }, [])

  const selectView = (view: FeedView) => {
    if (view === visualView) return

    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current)
    setVisualView(view)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    switchTimerRef.current = window.setTimeout(() => {
      savePreferredView(view)
      switchTimerRef.current = null
    }, reduceMotion ? 0 : 250)
  }

  return (
    <div
      ref={tabsRef}
      className="feed-view-switcher t-tabs"
      role="tablist"
      aria-label={ariaLabel}
    >
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {([
        { view: 'mosaic', label: 'Mosaico' },
        { view: 'list', label: 'Lista' },
      ] as const).map((option) => {
        const active = visualView === option.view
        return (
          <button
            key={option.view}
            ref={(element) => {
              tabRefs.current[option.view] = element
            }}
            type="button"
            className="t-tab"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => selectView(option.view)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const nextView = option.view === 'mosaic' ? 'list' : 'mosaic'
              selectView(nextView)
              window.requestAnimationFrame(() => tabRefs.current[nextView]?.focus())
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
