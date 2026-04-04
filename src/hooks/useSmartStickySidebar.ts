'use client'

import { RefObject, useEffect, useRef } from 'react'

interface UseSmartStickySidebarOptions {
  scrollRef: RefObject<HTMLElement | null>
  containerRef: RefObject<HTMLElement | null>
  contentRef: RefObject<HTMLElement | null>
  topOffset?: number
  bottomOffset?: number
  minWidth?: number
  disabled?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useSmartStickySidebar({
  scrollRef,
  containerRef,
  contentRef,
  topOffset = 80,
  bottomOffset = 24,
  minWidth = 1024,
  disabled = false,
}: UseSmartStickySidebarOptions) {
  const translateRef = useRef(0)
  const lastScrollTopRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const EPSILON = 0.5

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return

    const scroller = scrollRef.current
    const container = containerRef.current
    const content = contentRef.current

    if (!scroller || !container || !content) return

    const resetStyles = () => {
      content.style.transform = 'translate3d(0, 0, 0)'
      content.style.position = 'relative'
      content.style.top = '0'
      content.style.bottom = 'auto'
    }

    const applyStickyStyles = () => {
      content.style.transform = 'translate3d(0, 0, 0)'
      content.style.position = 'sticky'
      content.style.top = `${topOffset}px`
      content.style.bottom = 'auto'
    }

    const applyTranslateStyles = (translateY: number) => {
      content.style.position = 'relative'
      content.style.top = '0'
      content.style.bottom = 'auto'
      content.style.transform = `translate3d(0, ${translateY}px, 0)`
    }

    const roundTranslate = (value: number) => {
      return Math.round(value * 2) / 2
    }

    const clampTranslate = (value: number, maxTranslate: number) => {
      return clamp(roundTranslate(value), 0, maxTranslate)
    }

    const update = () => {
      frameRef.current = null

      if (window.innerWidth < minWidth) {
        translateRef.current = 0
        lastScrollTopRef.current = scroller.scrollTop
        resetStyles()
        return
      }

      const scrollerRect = scroller.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const containerTop = containerRect.top - scrollerRect.top + scroller.scrollTop
      const containerHeight = container.offsetHeight
      const sidebarHeight = content.offsetHeight
      const viewportHeight = scroller.clientHeight
      const availableHeight = viewportHeight - topOffset - bottomOffset
      const maxTranslate = Math.max(containerHeight - sidebarHeight, 0)
      const scrollTop = scroller.scrollTop

      if (sidebarHeight <= availableHeight) {
        translateRef.current = 0
        lastScrollTopRef.current = scrollTop
        applyStickyStyles()
        return
      }

      if (maxTranslate <= 0) {
        translateRef.current = 0
        lastScrollTopRef.current = scrollTop
        resetStyles()
        return
      }

      const scrollDelta = scrollTop - lastScrollTopRef.current
      const viewportTop = scrollTop + topOffset
      const viewportBottom = scrollTop + viewportHeight - bottomOffset
      const currentTop = containerTop + translateRef.current
      const currentBottom = currentTop + sidebarHeight

      let nextTranslate = translateRef.current

      if (scrollDelta > EPSILON && currentBottom < viewportBottom) {
        nextTranslate += viewportBottom - currentBottom
      } else if (scrollDelta < -EPSILON && currentTop > viewportTop) {
        nextTranslate -= currentTop - viewportTop
      }

      nextTranslate = clampTranslate(nextTranslate, maxTranslate)

      const isNearTopBoundary = scrollTop + topOffset <= containerTop
      const isNearBottomBoundary = containerTop + nextTranslate + sidebarHeight >= containerTop + containerHeight - EPSILON

      if (isNearTopBoundary) {
        nextTranslate = 0
      } else if (isNearBottomBoundary) {
        nextTranslate = maxTranslate
      }

      translateRef.current = clampTranslate(nextTranslate, maxTranslate)
      lastScrollTopRef.current = scrollTop
      applyTranslateStyles(translateRef.current)
    }

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(update)
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(scroller)
    resizeObserver.observe(container)
    resizeObserver.observe(content)

    scroller.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    scheduleUpdate()

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      resizeObserver.disconnect()
      scroller.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      resetStyles()
    }
  }, [bottomOffset, containerRef, contentRef, disabled, minWidth, scrollRef, topOffset])
}
