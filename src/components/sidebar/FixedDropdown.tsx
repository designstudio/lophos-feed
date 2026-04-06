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
  const [pos, setPos] = useState({ left: 0, bottom: 0 })

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ left: r.right + 4, bottom: window.innerHeight - r.top + 4 })
    }
  }, [anchorRef])

  return (
    <div
      className="fixed z-[999] w-56 rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]"
      style={{
        left: pos.left,
        bottom: pos.bottom,
        animation: 'slideUp 0.12s ease',
      }}
    >
      {children}
    </div>
  )
}
