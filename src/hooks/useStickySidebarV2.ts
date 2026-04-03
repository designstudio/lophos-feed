'use client'
import { useEffect, useRef } from 'react'

// Import sticky-sidebar-v2 dynamically to avoid SSR issues
let StickySidebar: any = null

const loadStickySidebar = async () => {
  if (!StickySidebar) {
    const module = await import('sticky-sidebar-v2')
    StickySidebar = module.default || module.StickySidebar
  }
  return StickySidebar
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
        sidebarInstanceRef.current = new StickySidebarClass(sidebarSelector, options)
        initializedRef.current = true

        console.log('StickySidebar v2 initialized:', {
          sidebarSelector,
          containerSelector,
          scrollContainer,
          options
        })

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
  }

  return {
    updateStickySidebar,
    destroyStickySidebar,
    isInitialized: () => initializedRef.current
  }
}
