'use client'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, TargetAndTransition } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

const SIDE_INITIAL: Record<string, TargetAndTransition> = {
  top: { opacity: 0, x: '-50%', y: 4 },
  right: { opacity: 0, x: -6, y: '-50%' },
  bottom: { opacity: 0, x: '-50%', y: -4 },
  left: { opacity: 0, x: 6, y: '-50%' },
}

const SIDE_ANIMATE: Record<string, TargetAndTransition> = {
  top: { opacity: 1, x: '-50%', y: 0 },
  right: { opacity: 1, x: 0, y: '-50%' },
  bottom: { opacity: 1, x: '-50%', y: 0 },
  left: { opacity: 1, x: 0, y: '-50%' },
}

export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<React.CSSProperties>({})
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setVisible(false)
  }, [disabled])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!visible || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      const tooltipRect = tooltipRef.current?.getBoundingClientRect()
      if (!rect || !tooltipRect) return

      const gap = 8

      if (side === 'right') {
        setPosition({
          position: 'fixed',
          left: rect.right + gap,
          top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        })
      } else if (side === 'left') {
        setPosition({
          position: 'fixed',
          left: rect.left - tooltipRect.width - gap,
          top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        })
      } else if (side === 'bottom') {
        setPosition({
          position: 'fixed',
          left: rect.left + rect.width / 2 - tooltipRect.width / 2,
          top: rect.bottom + gap,
        })
      } else {
        setPosition({
          position: 'fixed',
          left: rect.left + rect.width / 2 - tooltipRect.width / 2,
          top: rect.top - tooltipRect.height - gap,
        })
      }
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [side, visible])

  if (disabled || !content) return <>{children}</>

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {mounted && createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              ref={tooltipRef}
              style={position}
              initial={SIDE_INITIAL[side]}
              animate={SIDE_ANIMATE[side]}
              exit={SIDE_INITIAL[side]}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="z-[9999] pointer-events-none"
            >
              <span
                className="block px-2.5 py-1.5 text-[12px] font-semibold leading-none whitespace-nowrap"
                style={isDark ? {
                  background: '#2a2a2a',
                  color: '#f2f2f2',
                  border: '1px solid #404040',
                  borderRadius: '0.375rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
                } : {
                  background: 'var(--color-bg-secondary)',
                  color: '#0f1419',
                  border: '1px solid #E9E9E9',
                  borderRadius: '0.375rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                }}
              >
                {content}
              </span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
