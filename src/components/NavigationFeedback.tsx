'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const MIN_VISIBLE_MS = 300
const SAFETY_TIMEOUT_MS = 12_000
const NAVIGATION_START_EVENT = 'lophos:navigation-start'

export function startNavigationFeedback() {
  window.dispatchEvent(new Event(NAVIGATION_START_EVENT))
}

export function NavigationFeedback() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const startedAtRef = useRef(0)
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = () => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
    clearTimeoutRef.current = null
    pendingRef.current = false
    setPending(false)
  }

  useEffect(() => {
    const start = () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
      startedAtRef.current = Date.now()
      pendingRef.current = true
      setPending(true)
      clearTimeoutRef.current = setTimeout(finish, SAFETY_TIMEOUT_MS)
    }

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      if (anchor.dataset.navigationFeedback === 'false') return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return

      const currentRoute = `${window.location.pathname}${window.location.search}`
      const nextRoute = `${destination.pathname}${destination.search}`
      if (currentRoute === nextRoute) return

      start()
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener(NAVIGATION_START_EVENT, start)
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener(NAVIGATION_START_EVENT, start)
    }
  }, [])

  useEffect(() => {
    if (!pendingRef.current) return

    const elapsed = Date.now() - startedAtRef.current
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    const timeout = setTimeout(finish, remaining)
    return () => clearTimeout(timeout)
  }, [pathname])

  useEffect(() => () => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current)
  }, [])

  if (!pending) return null

  return (
    <div
      className="pointer-events-auto fixed inset-y-0 left-0 right-0 z-[9000] flex items-center justify-center bg-bg-primary md:left-20"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando próxima página"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-7 w-7 animate-spin rounded-full border-2 border-border-strong border-t-ink-primary"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-ink-secondary">Carregando…</span>
      </div>
    </div>
  )
}
