'use client'
import { useState, useEffect } from 'react'

export function FixedDropdown({
  anchorRef,
  onClose,
  children
}: {
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
  children: React.ReactNode
}) {
  const [pos, setPos] = useState({ right: 0, bottom: 0 })

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 4 })
    }
  }, [anchorRef])

  return (
    <div
      className="fixed w-52 rounded-xl shadow-xl z-[999] py-1"
      style={{
        right: pos.right,
        bottom: pos.bottom,
        animation: 'slideUp 0.12s ease',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)'
      }}
    >
      {children}
    </div>
  )
}
