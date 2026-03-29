'use client'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ACCENT_COLORS, applyAccent } from './utils'

export function AccentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ACCENT_COLORS.find(c => c.value === value) ?? ACCENT_COLORS[0]

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-sm text-gray-700 bg-white">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: current.dot }} />
        {current.label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn('transition-transform', open ? 'rotate-180' : '')}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-border shadow-lg z-50 py-1.5"
          style={{ animation: 'slideUp 0.12s ease' }}>
          {ACCENT_COLORS.map(c => (
            <button key={c.label} onClick={() => { onChange(c.value); applyAccent(c.value); setOpen(false) }}
              className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 transition-colors text-sm text-gray-700">
              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
              <span className="flex-1 text-left">{c.label}</span>
              {value === c.value && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="#111" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
