'use client'
import { useEffect, useRef, useCallback } from 'react'

// Import sticky-sidebar-v2 dynamically to avoid SSR issues
let StickySidebar: any = null

const loadStickySidebar = async () => {
  if (!StickySidebar) {
    const module = await import('sticky-sidebar-v2')
    StickySidebar = module.default || module.StickySidebar
  }
  return StickySidebar
}

const resetStickySidebarStyles = (sidebarSelector: string, innerWrapperSelector: string) => {
  const sidebarElement = document.querySelector(sidebarSelector) as HTMLElement | null
  const innerElement = sidebarElement?.querySelector(innerWrapperSelector) as HTMLElement | null

  if (sidebarElement) {
    sidebarElement.style.minHeight = ''
  }

  if (innerElement) {
    innerElement.style.position = ''
    innerElement.style.top = ''
    innerElement.style.bottom = ''
    innerElement.style.left = ''
    innerElement.style.right = ''
    innerElement.style.width = ''
    innerElement.style.transform = ''
  }
}

interface UseStickySidebarV2Props {
  sidebarSelector: string
  containerSelector?: string
  scrollContainer?: string
  topSpacing?: number
  bottomSpacing?: number
  innerWrapperSelector?: string
  minWidth?: number
  disabled?: boolean
}

export function useStickySidebarV2({
  sidebarSelector,
  containerSelector,
  scrollContainer,
  topSpacing = 56,
  bottomSpacing = 24,
  innerWrapperSelector = '.sidebar__inner',
  minWidth = 0,
  disabled = false
}: UseStickySidebarV2Props) {
  const sidebarInstanceRef = useRef<any>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (disabled) {
      // Clean up if disabled
      if (sidebarInstanceRef.current) {
        sidebarInstanceRef.current.destroy()
        sidebarInstanceRef.current = null
        initializedRef.current = false
      }
      resetStickySidebarStyles(sidebarSelector, innerWrapperSelector)
      return
    }

    const initializeStickySidebar = async () => {
      if (initializedRef.current) return

      try {
        const StickySidebarClass = await loadStickySidebar()
        
        if (!StickySidebarClass) {
          console.error('StickySidebar class not found')
          return
        }

        const options: any = {
          topSpacing,
          bottomSpacing,
          innerWrapperSelector,
          minWidth
        }

        if (containerSelector) {
          options.containerSelector = containerSelector
        }

        if (scrollContainer) {
          options.scrollContainer = scrollContainer
        }

        // Check if sidebar element exists
        const sidebarElement = document.querySelector(sidebarSelector)
        if (!sidebarElement) {
          console.warn(`Sidebar element not found: ${sidebarSelector}`)
          return
        }

        // Check if container element exists (if specified)
        if (containerSelector) {
          const containerElement = document.querySelector(containerSelector)
          if (!containerElement) {
            console.warn(`Container element not found: ${containerSelector}`)
            return
          }
        }

        // Check if scroll container exists (if specified)
        if (scrollContainer) {
          const scrollElement = document.querySelector(scrollContainer)
          if (!scrollElement) {
            console.warn(`Scroll container not found: ${scrollContainer}`)
            return
          }
        }

        // Initialize StickySidebar
        resetStickySidebarStyles(sidebarSelector, innerWrapperSelector)
        sidebarInstanceRef.current = new StickySidebarClass(sidebarSelector, options)
        initializedRef.current = true

      } catch (error) {
        console.error('Error initializing StickySidebar:', error)
      }
    }

    initializeStickySidebar()

    return () => {
      // Cleanup
      if (sidebarInstanceRef.current) {
        sidebarInstanceRef.current.destroy()
        sidebarInstanceRef.current = null
        initializedRef.current = false
      }
      resetStickySidebarStyles(sidebarSelector, innerWrapperSelector)
    }
  }, [
    disabled,
    sidebarSelector,
    containerSelector,
    scrollContainer,
    topSpacing,
    bottomSpacing,
    innerWrapperSelector,
    minWidth
  ])

  const updateStickySidebar = () => {
    if (sidebarInstanceRef.current && initializedRef.current) {
      sidebarInstanceRef.current.updateSticky()
    }
  }

  const destroyStickySidebar = () => {
    if (sidebarInstanceRef.current) {
      sidebarInstanceRef.current.destroy()
      sidebarInstanceRef.current = null
      initializedRef.current = false
    }
    resetStickySidebarStyles(sidebarSelector, innerWrapperSelector)
  }

  // Destroys the current instance and creates a fresh one.
  // Use after layout shifts (e.g. sidebar toggle) so measurements are clean.
  const reinitializeStickySidebar = useCallback(async () => {
    // Destroy first
    if (sidebarInstanceRef.current) {
      sidebarInstanceRef.current.destroy()
      sidebarInstanceRef.current = null
      initializedRef.current = false
    }
    resetStickySidebarStyles(sidebarSelector, innerWrapperSelector)

    try {
      const StickySidebarClass = await loadStickySidebar()
      if (!StickySidebarClass) return

      if (!document.querySelector(sidebarSelector)) {
        console.warn(`[StickySidebar] reinit: element not found: ${sidebarSelector}`)
        return
      }
      if (containerSelector && !document.querySelector(containerSelector)) {
        console.warn(`[StickySidebar] reinit: container not found: ${containerSelector}`)
        return
      }
      if (scrollContainer && !document.querySelector(scrollContainer)) {
        console.warn(`[StickySidebar] reinit: scroll container not found: ${scrollContainer}`)
        return
      }

      const options: any = { topSpacing, bottomSpacing, innerWrapperSelector, minWidth }
      if (containerSelector) options.containerSelector = containerSelector
      if (scrollContainer) options.scrollContainer = scrollContainer

      sidebarInstanceRef.current = new StickySidebarClass(sidebarSelector, options)
      initializedRef.current = true
    } catch (err) {
      console.error('[StickySidebar] reinit error:', err)
    }
  }, [sidebarSelector, containerSelector, scrollContainer, topSpacing, bottomSpacing, innerWrapperSelector, minWidth])

  return {
    updateStickySidebar,
    destroyStickySidebar,
    reinitializeStickySidebar,
    isInitialized: () => initializedRef.current
  }
}
