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
  const lastAppliedTranslateRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const EPSILON = 0.75

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return

    const scroller = scrollRef.current
    const container = containerRef.current
    const content = contentRef.current

    if (!scroller || !container || !content) return

    const resetStyles = () => {
      lastAppliedTranslateRef.current = 0
      content.style.transform = 'translate3d(0, 0, 0)'
      content.style.position = 'relative'
      content.style.top = '0'
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
      const scrollDelta = scrollTop - lastScrollTopRef.current

      if (maxTranslate <= 0) {
        translateRef.current = 0
        lastScrollTopRef.current = scrollTop
        resetStyles()
        return
      }

      let nextTranslate = translateRef.current

      if (sidebarHeight <= availableHeight) {
        nextTranslate = clamp(scrollTop + topOffset - containerTop, 0, maxTranslate)
      } else {
        const scrollingDown = scrollDelta > EPSILON
        const scrollingUp = scrollDelta < -EPSILON

        if (scrollingDown) {
          const bottomPinnedTranslate =
            scrollTop + viewportHeight - bottomOffset - containerTop - sidebarHeight

          if (bottomPinnedTranslate > nextTranslate + EPSILON) {
            nextTranslate = Math.min(bottomPinnedTranslate, maxTranslate)
          }
        } else if (scrollingUp) {
          const topPinnedTranslate = scrollTop + topOffset - containerTop

          if (topPinnedTranslate < nextTranslate - EPSILON) {
            nextTranslate = Math.max(topPinnedTranslate, 0)
          }
        }
      }

      translateRef.current = clamp(nextTranslate, 0, maxTranslate)
      lastScrollTopRef.current = scrollTop

      const roundedTranslate = Math.round(translateRef.current * 2) / 2

      if (Math.abs(roundedTranslate - lastAppliedTranslateRef.current) <= EPSILON) {
        return
      }

      lastAppliedTranslateRef.current = roundedTranslate
      content.style.transform = `translate3d(0, ${roundedTranslate}px, 0)`
      content.style.position = 'relative'
      content.style.top = '0'
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
