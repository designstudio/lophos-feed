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

    const reset = () => {
      translateRef.current = 0
      content.style.position = 'relative'
      content.style.top = '0px'
      content.style.bottom = 'auto'
      content.style.transform = 'none'
    }

    const applyTopSticky = () => {
      translateRef.current = 0
      content.style.position = 'sticky'
      content.style.top = `${topOffset}px`
      content.style.bottom = 'auto'
      content.style.transform = 'none'
    }

    const applyRelativeTop = (top: number) => {
      content.style.position = 'relative'
      content.style.top = `${Math.round(top)}px`
      content.style.bottom = 'auto'
      content.style.transform = 'none'
    }

    const update = () => {
      frameRef.current = null

      if (window.innerWidth < minWidth) {
        lastScrollTopRef.current = scroller.scrollTop
        reset()
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
        lastScrollTopRef.current = scrollTop
        applyTopSticky()
        return
      }

      if (maxTranslate <= 0) {
        lastScrollTopRef.current = scrollTop
        reset()
        return
      }

      const scrollDelta = scrollTop - lastScrollTopRef.current
      const topPinnedTranslate = scrollTop + topOffset - containerTop
      const bottomPinnedTranslate =
        scrollTop + viewportHeight - bottomOffset - containerTop - sidebarHeight

      let nextTranslate = translateRef.current

      if (scrollDelta > EPSILON) {
        nextTranslate = Math.max(nextTranslate, bottomPinnedTranslate)
      } else if (scrollDelta < -EPSILON) {
        nextTranslate = Math.min(nextTranslate, topPinnedTranslate)
      }

      nextTranslate = clamp(nextTranslate, 0, maxTranslate)

      translateRef.current = nextTranslate
      lastScrollTopRef.current = scrollTop
      applyRelativeTop(nextTranslate)
    }

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(update)
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)
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
      reset()
    }
  }, [bottomOffset, containerRef, contentRef, disabled, minWidth, scrollRef, topOffset])
}
