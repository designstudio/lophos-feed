'use client'
import { useEffect, useRef, useCallback } from 'react'

interface UseSmartStickySidebarProps {
  scrollerRef: React.RefObject<HTMLElement>
  sidebarRef: React.RefObject<HTMLElement>
  containerRef: React.RefObject<HTMLDivElement>
  topOffset?: number
  debug?: boolean
}

// Helper function to get offsetTop within a specific parent
function getOffsetTopWithin(scroller: HTMLElement, element: HTMLElement): number {
  let offsetTop = 0
  let current: HTMLElement | null = element
  
  while (current && current !== scroller) {
    offsetTop += current.offsetTop
    current = current.offsetParent as HTMLElement
  }
  
  return offsetTop
}

const DEBUG = false // Global debug flag

export function useSmartStickySidebar({
  scrollerRef,
  sidebarRef,
  containerRef,
  topOffset = 56
}: UseSmartStickySidebarProps) {
  const animationFrameRef = useRef<number>()
  const resizeObserverRef = useRef<ResizeObserver>()
  const currentYRef = useRef(0)
  const lastScrollTopRef = useRef(0)
  const heightsRef = useRef({
    sidebar: 0,
    container: 0,
    viewport: 0,
    scrollerContent: 0
  })

  const log = DEBUG ? console.log : () => {}

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
  }, [])

  // Update sidebar position using delta scroll
  const updateSidebarPosition = useCallback(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current
    
    if (!scroller || !sidebar || !container) {
      return
    }

    const { sidebar: sidebarHeight, container: containerHeight, viewport } = heightsRef.current
    
    // Get positions relative to scroller
    const containerTopInScroller = getOffsetTopWithin(scroller, container)
    const sidebarTopInScroller = getOffsetTopWithin(scroller, sidebar)
    
    // Current scroll position
    const scrollTop = scroller.scrollTop
    const deltaScroll = scrollTop - lastScrollTopRef.current
    lastScrollTopRef.current = scrollTop

    // Calculate bounds
    const minY = topOffset
    const maxY = containerHeight - sidebarHeight
    
    // Calculate ideal Y position based on scroll
    let targetY = currentYRef.current
    
    // When scrolling down
    if (deltaScroll > 0) {
      const viewportTop = scrollTop + topOffset
      if (sidebarTopInScroller + currentYRef.current < viewportTop) {
        targetY = viewportTop - sidebarTopInScroller
      }
    }
    // When scrolling up
    else if (deltaScroll < 0) {
      const viewportBottom = scrollTop + viewport
      const sidebarBottom = sidebarTopInScroller + currentYRef.current + sidebarHeight
      if (sidebarBottom > viewportBottom) {
        targetY = viewportBottom - sidebarBottom
      }
    }

    // Clamp within bounds
    targetY = Math.max(minY, Math.min(maxY, targetY))
    
    // Apply with rounding to avoid subpixel jitter
    const roundedY = Math.round(targetY)
    sidebar.style.transform = `translate3d(0, ${roundedY}px, 0)`
    currentYRef.current = targetY

    if (DEBUG) {
      log('update:', {
        scrollTop,
        deltaScroll,
        containerTopInScroller,
        sidebarTopInScroller,
        targetY,
        roundedY,
        minY,
        maxY
      })
    }
  }, [topOffset])

  // Debounced scroll handler with requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (animationFrameRef.current) {
      return
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      updateSidebarPosition()
      animationFrameRef.current = undefined
    })
  }, [updateSidebarPosition])

  // Setup scroll listener
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) {
      return
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [scrollerRef.current, handleScroll])

  // Setup ResizeObserver with debounced updates
  useEffect(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current
    
    if (!scroller || !sidebar || !container) {
      return
    }

    // Clean up previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
    }

    let resizeTimeout: NodeJS.Timeout

    resizeObserverRef.current = new ResizeObserver(() => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        calculateHeights()
        updateSidebarPosition()
      }, 16) // Debounce to ~60fps
    })

    // Observe all relevant elements
    resizeObserverRef.current.observe(scroller)
    resizeObserverRef.current.observe(sidebar)
    resizeObserverRef.current.observe(container)

    return () => {
      clearTimeout(resizeTimeout)
      resizeObserverRef.current?.disconnect()
    }
  }, [scrollerRef.current, sidebarRef.current, containerRef.current, calculateHeights, updateSidebarPosition])

  // Initial calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateHeights()
      updateSidebarPosition()
    }, 100)

    return () => clearTimeout(timer)
  }, [scrollerRef.current, sidebarRef.current, containerRef.current, calculateHeights, updateSidebarPosition])

  return {
    recalculate: () => {
      calculateHeights()
      updateSidebarPosition()
    }
  }
}
