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
  const modeRef = useRef<'natural' | 'top' | 'bottom'>('natural')
  const EPSILON = 0.5

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return

    const scroller = scrollRef.current
    const container = containerRef.current
    const content = contentRef.current

    if (!scroller || !container || !content) return

    const resetStyles = () => {
      modeRef.current = 'natural'
      content.style.transform = 'none'
      content.style.position = 'relative'
      content.style.top = '0'
      content.style.bottom = 'auto'
    }

    const applyStickyStyles = () => {
      modeRef.current = 'top'
      content.style.transform = 'none'
      content.style.position = 'sticky'
      content.style.top = `${topOffset}px`
      content.style.bottom = 'auto'
    }

    const applyTranslateStyles = (translateY: number) => {
      content.style.transform = 'none'
      content.style.position = 'relative'
      content.style.top = `${Math.round(translateY)}px`
      content.style.bottom = 'auto'
    }

    const clampTranslate = (value: number, maxTranslate: number) => {
      return clamp(Math.round(value), 0, maxTranslate)
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
      const viewportTop = topOffset
      const viewportBottom = viewportHeight - bottomOffset
      let nextTranslate = translateRef.current
      let nextMode = modeRef.current
      const currentTopInViewport = containerTop + translateRef.current - scrollTop
      const currentBottomInViewport = currentTopInViewport + sidebarHeight

      if (nextMode === 'natural') {
        if (scrollDelta > EPSILON && currentBottomInViewport <= viewportBottom + EPSILON) {
          nextMode = 'bottom'
          nextTranslate = scrollTop + viewportHeight - bottomOffset - containerTop - sidebarHeight
        } else if (scrollDelta < -EPSILON && currentTopInViewport >= viewportTop - EPSILON) {
          nextMode = 'top'
          nextTranslate = scrollTop + topOffset - containerTop
        }
      } else if (nextMode === 'bottom') {
        if (scrollDelta > EPSILON) {
          nextTranslate += scrollDelta
        } else if (scrollDelta < -EPSILON && currentTopInViewport >= viewportTop - EPSILON) {
          nextMode = 'top'
          nextTranslate = scrollTop + topOffset - containerTop
        }
      } else if (nextMode === 'top') {
        if (scrollDelta < -EPSILON) {
          nextTranslate += scrollDelta
        } else if (scrollDelta > EPSILON && currentBottomInViewport <= viewportBottom + EPSILON) {
          nextMode = 'bottom'
          nextTranslate = scrollTop + viewportHeight - bottomOffset - containerTop - sidebarHeight
        }
      }

      nextTranslate = clampTranslate(nextTranslate, maxTranslate)
      if (nextTranslate <= EPSILON) {
        nextTranslate = 0
        nextMode = 'natural'
      } else if (nextTranslate >= maxTranslate - EPSILON) {
        nextTranslate = maxTranslate
        nextMode = 'natural'
      }

      lastScrollTopRef.current = scrollTop
      translateRef.current = nextTranslate
      modeRef.current = nextMode

      if (nextMode === 'top') {
        applyStickyStyles()
        return
      }

      applyTranslateStyles(nextTranslate)
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
