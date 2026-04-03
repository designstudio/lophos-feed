'use client'
import { useEffect, useRef, useCallback } from 'react'

interface UseSmartStickySidebarProps {
  scrollerRef: React.RefObject<HTMLElement>
  sidebarRef: React.RefObject<HTMLElement>
  containerRef: React.RefObject<HTMLDivElement>
  topOffset?: number
  debug?: boolean
}

export function useSmartStickySidebar({
  scrollerRef,
  sidebarRef,
  containerRef,
  topOffset = 56,
  debug = false
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

  const log = debug ? console.log : () => {}

  // Calculate all heights and bounds
  const calculateHeights = useCallback(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current

    if (!scroller || !sidebar || !container) {
      log('calculateHeights: missing elements', { scroller: !!scroller, sidebar: !!sidebar, container: !!container })
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

    log('calculateHeights:', { 
      ...heightsRef.current,
      containerClassName: container.className,
      containerOffsetHeight: container.offsetHeight
    })
    return heightsRef.current
  }, [])

  // Calculate the optimal translateY for the sidebar
  const calculateTranslateY = useCallback((scrollTop: number) => {
    const { sidebar, viewport, scrollerContent } = heightsRef.current
    const scroller = scrollerRef.current
    const containerElement = containerRef.current
    if (!scroller || !containerElement) {
      log('calculateTranslateY: missing elements')
      return 0
    }

    // Use container height directly from the element to ensure we get the correct value
    const containerHeight = containerElement.offsetHeight
    log('calculateTranslateY container info:', {
      containerClassName: containerElement.className,
      containerHeight,
      containerOffsetHeight: containerElement.offsetHeight
    })

    // Available space for sidebar to move within
    const containerTop = containerElement.offsetTop
    const containerBottom = containerTop + containerHeight
    
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
    const maxBottom = containerHeight - sidebar
    if (maxBottom < maxTop) {
      // Container is smaller than sidebar, clamp to top
      log('calculateTranslateY: container smaller than sidebar, clamp to top', { 
        containerHeight, 
        sidebar, 
        maxBottom, 
        maxTop 
      })
      return maxTop
    }

    // Calculate ideal position based on scroll
    let translateY = 0

    // When scrolling down, sidebar should stick to viewport top
    if (sidebarTop < viewportTop) {
      translateY = viewportTop - containerTop
      log('calculateTranslateY: scrolling down, stick to top', { translateY })
    }
    
    // When scrolling up, sidebar should stick to viewport bottom if needed
    if (sidebarBottom > viewportBottom) {
      translateY = viewportBottom - sidebar - containerTop
      log('calculateTranslateY: scrolling up, stick to bottom', { translateY })
    }

    // Clamp within container bounds
    translateY = Math.max(maxTop, Math.min(maxBottom, translateY))

    log('calculateTranslateY final:', { 
      scrollTop, 
      containerTop, 
      containerHeight,
      translateY, 
      sidebarTop, 
      viewportTop,
      sidebarBottom,
      viewportBottom,
      maxBottom
    })

    return translateY
  }, [topOffset])

  // Update sidebar position
  const updateSidebarPosition = useCallback(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    if (!scroller || !sidebar) {
      log('updateSidebarPosition: missing elements')
      return
    }

    const scrollTop = scroller.scrollTop
    const translateY = calculateTranslateY(scrollTop)

    // Apply transform
    sidebar.style.transform = `translateY(${translateY}px)`
    lastScrollTopRef.current = scrollTop
    
    log('updateSidebarPosition applied:', { scrollTop, translateY })
  }, [calculateTranslateY])

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

  // Setup scroll listener - re-run when refs change
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) {
      log('Scroll listener: scroller not available')
      return
    }

    log('Setting up scroll listener on:', scroller.className)
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      log('Cleaning up scroll listener')
      scroller.removeEventListener('scroll', handleScroll)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [scrollerRef.current, handleScroll]) // Depend on scrollerRef.current to re-run when element changes

  // Setup ResizeObserver to recalculate heights - re-run when refs change
  useEffect(() => {
    const scroller = scrollerRef.current
    const sidebar = sidebarRef.current
    const container = containerRef.current
    
    if (!scroller || !sidebar || !container) {
      log('ResizeObserver: missing elements')
      return
    }

    log('Setting up ResizeObserver')

    // Clean up previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
    }

    resizeObserverRef.current = new ResizeObserver(() => {
      log('ResizeObserver triggered')
      calculateHeights()
      updateSidebarPosition()
    })

    // Observe all relevant elements
    resizeObserverRef.current.observe(scroller)
    resizeObserverRef.current.observe(sidebar)
    resizeObserverRef.current.observe(container)

    return () => {
      log('Cleaning up ResizeObserver')
      resizeObserverRef.current?.disconnect()
    }
  }, [scrollerRef.current, sidebarRef.current, containerRef.current, calculateHeights, updateSidebarPosition])

  // Initial calculation and re-calculation when refs become available
  useEffect(() => {
    const timer = setTimeout(() => {
      log('Initial calculation triggered')
      calculateHeights()
      updateSidebarPosition()
    }, 100) // Small delay to ensure DOM is ready

    return () => clearTimeout(timer)
  }, [scrollerRef.current, sidebarRef.current, containerRef.current, calculateHeights, updateSidebarPosition])

  return {
    recalculate: () => {
      log('Manual recalculate triggered')
      calculateHeights()
      updateSidebarPosition()
    }
  }
}
