'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence, TargetAndTransition } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactNode
  /** Sobrescreve a classe do wrapper. Padrão: relative inline-flex. */
  className?: string
  /** Desativa o tooltip (renderiza apenas os children sem wrapper). */
  disabled?: boolean
}

// Posicionamento via style inline para não conflitar com os transforms do Framer Motion
const SIDE_STYLE: Record<string, React.CSSProperties> = {
  top:    { position: 'absolute', bottom: '100%', left: '50%', marginBottom: '8px' },
  right:  { position: 'absolute', left: '100%',  top: '50%',  marginLeft:   '8px' },
  bottom: { position: 'absolute', top: '100%',   left: '50%', marginTop:    '8px' },
  left:   { position: 'absolute', right: '100%', top: '50%',  marginRight:  '8px' },
}

// Slide de 2px na direção correta — Framer Motion só cuida de opacity + translate
const SIDE_INITIAL: Record<string, TargetAndTransition> = {
  top:    { opacity: 0, x: '-50%', y: 4  },
  right:  { opacity: 0, x: -6,    y: '-50%' },
  bottom: { opacity: 0, x: '-50%', y: -4 },
  left:   { opacity: 0, x: 6,     y: '-50%' },
}

const SIDE_ANIMATE: Record<string, TargetAndTransition> = {
  top:    { opacity: 1, x: '-50%', y: 0 },
  right:  { opacity: 1, x: 0,     y: '-50%' },
  bottom: { opacity: 1, x: '-50%', y: 0 },
  left:   { opacity: 1, x: 0,     y: '-50%' },
}

export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  // Sem tooltip: renderiza children diretamente (sem wrapper no DOM)
  if (disabled || !content) return <>{children}</>

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
            style={SIDE_STYLE[side]}
            initial={SIDE_INITIAL[side]}
            animate={SIDE_ANIMATE[side]}
            exit={SIDE_INITIAL[side]}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="z-[9999] pointer-events-none"
          >
            {/* Estilo Grok — fundo claro fixo mesmo no dark mode */}
            <span
              className="block px-2.5 py-1.5 text-[12px] font-semibold leading-none whitespace-nowrap"
              style={{
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
      </AnimatePresence>
    </div>
  )
}
