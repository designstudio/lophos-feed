'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

interface TooltipProps {
  content: string
  side?: TooltipSide
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

type ActiveTooltip = {
  trigger: HTMLElement
  content: string
  side: TooltipSide
}

type TooltipContextValue = {
  show: (tooltip: ActiveTooltip) => void
  hide: (trigger: HTMLElement) => void
  dismiss: () => void
}

const TooltipContext = createContext<TooltipContextValue | null>(null)

const ANIMATION_BY_SIDE = {
  top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
  right: { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 } },
  bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
  left: { initial: { opacity: 0, x: 6 }, animate: { opacity: 1, x: 0 } },
} as const

function getAnchor(trigger: HTMLElement, side: TooltipSide): React.CSSProperties {
  const rect = trigger.getBoundingClientRect()
  const gap = 8

  if (side === 'right') {
    return { position: 'fixed', left: rect.right + gap, top: rect.top + rect.height / 2, transform: 'translateY(-50%)' }
  }
  if (side === 'left') {
    return { position: 'fixed', left: rect.left - gap, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' }
  }
  if (side === 'bottom') {
    return { position: 'fixed', left: rect.left + rect.width / 2, top: rect.bottom + gap, transform: 'translateX(-50%)' }
  }
  return { position: 'fixed', left: rect.left + rect.width / 2, top: rect.top - gap, transform: 'translate(-50%, -100%)' }
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState<ActiveTooltip | null>(null)
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null)
  const activeRef = useRef<ActiveTooltip | null>(null)
  const ignoreShowUntilRef = useRef(0)

  const dismiss = useCallback(() => {
    activeRef.current = null
    setActive(null)
    setAnchor(null)
  }, [])

  const dismissImmediately = useCallback(() => {
    ignoreShowUntilRef.current = performance.now() + 300
    flushSync(dismiss)
  }, [dismiss])

  const show = useCallback((tooltip: ActiveTooltip) => {
    if (
      document.visibilityState !== 'visible'
      || !document.hasFocus()
      || performance.now() < ignoreShowUntilRef.current
    ) return

    activeRef.current = tooltip
    setAnchor(getAnchor(tooltip.trigger, tooltip.side))
    setActive(tooltip)
  }, [])

  const hide = useCallback((trigger: HTMLElement) => {
    if (activeRef.current?.trigger === trigger) dismiss()
  }, [dismiss])

  useEffect(() => {
    setMounted(true)

    const updateAnchor = () => {
      const tooltip = activeRef.current
      if (tooltip) setAnchor(getAnchor(tooltip.trigger, tooltip.side))
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') dismissImmediately()
    }
    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') ignoreShowUntilRef.current = performance.now() + 300
    }

    window.addEventListener('blur', dismissImmediately)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pagehide', dismissImmediately)
    window.addEventListener('scroll', updateAnchor, true)
    window.addEventListener('resize', updateAnchor)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', dismissImmediately)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pagehide', dismissImmediately)
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('resize', updateAnchor)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [dismissImmediately])

  useEffect(() => {
    dismiss()
  }, [dismiss, pathname])

  const value = React.useMemo(() => ({ show, hide, dismiss }), [dismiss, hide, show])
  const motionConfig = active ? ANIMATION_BY_SIDE[active.side] : ANIMATION_BY_SIDE.top

  return (
    <TooltipContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {active && anchor && (
            <div style={anchor} className="z-[9999] pointer-events-none">
              <motion.div
                initial={motionConfig.initial}
                animate={motionConfig.animate}
                exit={{
                  ...motionConfig.initial,
                  transition: { duration: reduceMotion ? 0 : 0.15, delay: 0, ease: 'easeOut' },
                }}
                transition={{
                  duration: reduceMotion ? 0 : 0.15,
                  delay: reduceMotion ? 0 : 0.08,
                  ease: 'easeOut',
                }}
              >
                <span
                  role="tooltip"
                  className="block whitespace-nowrap rounded-full border border-border bg-[var(--color-tooltip-bg)] px-3 py-1.5 text-[12px] font-medium leading-none text-[var(--color-tooltip-ink)] shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                >
                  {active.content}
                </span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </TooltipContext.Provider>
  )
}

export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const manager = useContext(TooltipContext)
  if (!manager) throw new Error('Tooltip must be used inside TooltipProvider')

  if (disabled || !content) return <>{children}</>

  const showTooltip = (trigger: HTMLElement) => manager.show({ trigger, content, side })

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={(event) => manager.hide(event.currentTarget)}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={(event) => manager.hide(event.currentTarget)}
      onPointerDown={manager.dismiss}
    >
      {children}
    </div>
  )
}
