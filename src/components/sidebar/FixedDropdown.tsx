'use client'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function FixedDropdown({
  anchorRef,
  open,
  closing,
  children
}: {
  anchorRef: React.RefObject<HTMLElement>
  open: boolean
  closing: boolean
  children: React.ReactNode
}) {
  const [pos, setPos] = useState({ left: 0, bottom: 0 })

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const dropdownWidth = 192
      const viewportPadding = 12
      const left = Math.min(
        Math.max(r.left, viewportPadding),
        window.innerWidth - dropdownWidth - viewportPadding
      )

      setPos({ left, bottom: window.innerHeight - r.top + 4 })
    }
  }, [anchorRef, open])

  return (
    <div
      className={cn(
        't-dropdown fixed z-[999] w-48 rounded-xl bg-[var(--color-bg-elevated)] p-1',
        open && 'is-open',
        closing && 'is-closing',
      )}
      data-origin="bottom-left"
      aria-hidden={!open}
      inert={!open}
      style={{
        left: pos.left,
        bottom: pos.bottom,
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px #0000000d',
      }}
    >
      {children}
    </div>
  )
}
