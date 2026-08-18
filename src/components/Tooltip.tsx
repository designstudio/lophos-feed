'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

const ANIMATION_BY_SIDE = {
  top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
  right: { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 } },
  bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
  left: { initial: { opacity: 0, x: 6 }, animate: { opacity: 1, x: 0 } },
} as const

export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  const getAnchor = useCallback((): React.CSSProperties | null => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return null

    const gap = 8

    if (side === 'right') {
      return {
        position: 'fixed',
        left: rect.right + gap,
        top: rect.top + rect.height / 2,
        transform: 'translateY(-50%)',
      }
    }

    if (side === 'left') {
      return {
        position: 'fixed',
        left: rect.left - gap,
        top: rect.top + rect.height / 2,
        transform: 'translate(-100%, -50%)',
      }
    }

    if (side === 'bottom') {
      return {
        position: 'fixed',
        left: rect.left + rect.width / 2,
        top: rect.bottom + gap,
        transform: 'translateX(-50%)',
      }
    }

    return {
      position: 'fixed',
      left: rect.left + rect.width / 2,
      top: rect.top - gap,
      transform: 'translate(-50%, -100%)',
    }
  }, [side])

  const showTooltip = useCallback(() => {
    const nextAnchor = getAnchor()
    if (!nextAnchor) return

    // Set the fixed coordinates before mounting the portal. Rendering the
    // tooltip in normal body flow for even one frame changes the scrollbars.
    setAnchor(nextAnchor)
    setVisible(true)
  }, [getAnchor])

  useEffect(() => {
    setVisible(false)
  }, [disabled])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!visible || !triggerRef.current) return

    const updateAnchor = () => {
      const nextAnchor = getAnchor()
      if (nextAnchor) setAnchor(nextAnchor)
    }

    updateAnchor()
    window.addEventListener('scroll', updateAnchor, true)
    window.addEventListener('resize', updateAnchor)

    return () => {
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('resize', updateAnchor)
    }
  }, [getAnchor, visible])

  if (disabled || !content) return <>{children}</>

  const motionConfig = ANIMATION_BY_SIDE[side]

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setVisible(false)}
      onFocus={showTooltip}
      onBlur={() => setVisible(false)}
    >
      {children}

      {mounted && createPortal(
        <AnimatePresence>
          {visible && anchor && (
            <div style={anchor} className="z-[9999] pointer-events-none">
              <motion.div
                initial={motionConfig.initial}
                animate={motionConfig.animate}
                exit={motionConfig.initial}
                transition={{ duration: 0.12, ease: 'easeOut' }}
              >
                <span
                  role="tooltip"
                  className="block whitespace-nowrap rounded-full border border-border bg-[var(--color-tooltip-bg)] px-3 py-1.5 text-[12px] font-medium leading-none text-[var(--color-tooltip-ink)] shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                >
                  {content}
                </span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
