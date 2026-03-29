'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
  /** Sobrescreve a classe do wrapper. Padrão: inline-flex relative. */
  className?: string
  /** Desativa o tooltip (renderiza apenas os children sem wrapper). */
  disabled?: boolean
}

const SIDE_CONFIG = {
  top:    { pos: 'bottom-full left-1/2 -translate-x-1/2 mb-2',  initial: { opacity: 0, y:  4, x: '-50%' }, animate: { opacity: 1, y:  0, x: '-50%' } },
  right:  { pos: 'left-full top-1/2 -translate-y-1/2 ml-2',     initial: { opacity: 0, x: -6, y: '-50%' }, animate: { opacity: 1, x:  0, y: '-50%' } },
  bottom: { pos: 'top-full left-1/2 -translate-x-1/2 mt-2',     initial: { opacity: 0, y: -4, x: '-50%' }, animate: { opacity: 1, y:  0, x: '-50%' } },
  left:   { pos: 'right-full top-1/2 -translate-y-1/2 mr-2',    initial: { opacity: 0, x:  6, y: '-50%' }, animate: { opacity: 1, x:  0, y: '-50%' } },
}

export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  // Sem tooltip: renderiza children diretamente (sem wrapper no DOM)
  if (disabled || !content) return <>{children}</>

  const cfg = SIDE_CONFIG[side]

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={cfg.initial}
            animate={cfg.animate}
            exit={cfg.initial}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={cn('absolute z-[9999] pointer-events-none', cfg.pos)}
          >
            {/* Estilo Grok — fundo claro mesmo no dark mode */}
            <span
              className="block px-2.5 py-1.5 rounded-lg text-[12px] font-semibold leading-none whitespace-nowrap"
              style={{
                background: '#f0f7ff',
                color: '#0f1419',
                border: '1px solid #cfd9de',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              }}
            >
              {content}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
