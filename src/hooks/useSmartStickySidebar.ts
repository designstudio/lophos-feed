'use client'
import { useEffect, useRef, useCallback } from 'react'

interface UseSmartStickySidebarProps {
  scrollerRef: React.RefObject<HTMLElement>
  sidebarRef: React.RefObject<HTMLElement>
  containerRef: React.RefObject<HTMLElement>
  topOffset?: number
}

export function useSmartStickySidebar({
  scrollerRef,
  sidebarRef,
  containerRef,
  topOffset = 56
}: UseSmartStickySidebarProps) {
  const animationFrameRef = useRef<number>()
  const resizeObserverRef = useRef<ResizeObserver>()
  const lastScrollTopRef = useRef(0)
  const heightsRef = useRef({
    sidebar: 0,
    container: 0,
    viewport: 0,
    scrollerContent: 0
  })

  // Calculate all heights and bounds
  const calculateHeights = useCallback(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current

    if (!scroller || !sidebar || !container) {
      return heightsRef.current
    }

    const viewport = scroller.clientHeight
    const scrollerContent = scroller.scrollHeight
    const sidebarHeight = sidebar.offsetHeight
    const containerHeight = container.offsetHeight

    heightsRef.current = {
      sidebar: sidebarHeight,
      container: containerHeight,
      viewport,
      scrollerContent
    }

    return heightsRef.current
  }, [scrollerRef, sidebarRef, containerRef])

  // Calculate the optimal translateY for the sidebar
  const calculateTranslateY = useCallback((scrollTop: number) => {
    const { sidebar, container, viewport, scrollerContent } = heightsRef.current
    const scroller = scrollerRef.current
    if (!scroller) return 0

    // Available space for sidebar to move within
    const containerTop = container.offsetTop
    const containerBottom = containerTop + container
    
    // Viewport boundaries
    const viewportTop = scrollTop + topOffset
    const viewportBottom = scrollTop + viewport
    
    // Sidebar boundaries (if positioned at topOffset)
    const sidebarTop = containerTop + topOffset
    const sidebarBottom = sidebarTop + sidebar

    // Calculate constraints
    // 1. Don't go above container top + topOffset
    const maxTop = topOffset
    // 2. Don't go below container bottom - sidebar height
    const maxBottom = container - sidebar
    if (maxBottom < maxTop) {
      // Container is smaller than sidebar, clamp to top
      return maxTop
    }

    // Calculate ideal position based on scroll
    let translateY = 0

    // When scrolling down, sidebar should stick to viewport top
    if (sidebarTop < viewportTop) {
      translateY = viewportTop - containerTop
    }
    
    // When scrolling up, sidebar should stick to viewport bottom if needed
    if (sidebarBottom > viewportBottom) {
      translateY = viewportBottom - sidebar - containerTop
    }

    // Clamp within container bounds
    translateY = Math.max(maxTop, Math.min(maxBottom, translateY))

    return translateY
  }, [scrollerRef, topOffset])

  // Update sidebar position
  const updateSidebarPosition = useCallback(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    if (!scroller || !sidebar) return

    const scrollTop = scroller.scrollTop
    const translateY = calculateTranslateY(scrollTop)

    // Apply transform
    sidebar.style.transform = `translateY(${translateY}px)`
    lastScrollTopRef.current = scrollTop
  }, [scrollerRef, sidebarRef, calculateTranslateY])

  // Scroll handler with requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      updateSidebarPosition()
      animationFrameRef.current = undefined
    })
  }, [updateSidebarPosition])

  // Setup scroll listener
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [scrollerRef, handleScroll])

  // Setup ResizeObserver to recalculate heights
  useEffect(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current
    
    if (!scroller || !sidebar || !container) return

    // Clean up previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
    }

    resizeObserverRef.current = new ResizeObserver(() => {
      calculateHeights()
      updateSidebarPosition()
    })

    // Observe all relevant elements
    resizeObserverRef.current.observe(scroller)
    resizeObserverRef.current.observe(sidebar)
    resizeObserverRef.current.observe(container)

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [scrollerRef, sidebarRef, containerRef, calculateHeights, updateSidebarPosition])

  // Initial calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateHeights()
      updateSidebarPosition()
    }, 100) // Small delay to ensure DOM is ready

    return () => clearTimeout(timer)
  }, [calculateHeights, updateSidebarPosition])

  return {
    recalculate: () => {
      calculateHeights()
      updateSidebarPosition()
    }
  }
}
