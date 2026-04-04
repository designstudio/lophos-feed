'use client'
import React, { useEffect, useState } from 'react'
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
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [anchor, setAnchor] = useState<React.CSSProperties>({})
  const triggerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisible(false)
  }, [disabled])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !triggerRef.current) return

    const updateAnchor = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const gap = 8

      if (side === 'right') {
        setAnchor({
          position: 'fixed',
          left: rect.right + gap,
          top: rect.top + rect.height / 2,
          transform: 'translateY(-50%)',
        })
      } else if (side === 'left') {
        setAnchor({
          position: 'fixed',
          left: rect.left - gap,
          top: rect.top + rect.height / 2,
          transform: 'translate(-100%, -50%)',
        })
      } else if (side === 'bottom') {
        setAnchor({
          position: 'fixed',
          left: rect.left + rect.width / 2,
          top: rect.bottom + gap,
          transform: 'translateX(-50%)',
        })
      } else {
        setAnchor({
          position: 'fixed',
          left: rect.left + rect.width / 2,
          top: rect.top - gap,
          transform: 'translate(-50%, -100%)',
        })
      }
    }

    updateAnchor()
    window.addEventListener('scroll', updateAnchor, true)
    window.addEventListener('resize', updateAnchor)

    return () => {
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('resize', updateAnchor)
    }
  }, [side, visible])

  if (disabled || !content) return <>{children}</>

  const motionConfig = ANIMATION_BY_SIDE[side]

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
            <div style={anchor} className="z-[9999] pointer-events-none">
              <motion.div
                initial={motionConfig.initial}
                animate={motionConfig.animate}
                exit={motionConfig.initial}
                transition={{ duration: 0.12, ease: 'easeOut' }}
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
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
