'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Settings01 as Settings, LogOut01 as Logout } from '@untitledui/icons'
import { Tooltip } from '@/components/Tooltip'
import { FixedDropdown } from './FixedDropdown'

export function CollapsedUserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative mt-auto">
      <Tooltip content={user?.firstName ?? 'Conta'} side="right">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors"
        >
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full" />
          ) : (
            <div
              className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: 'var(--color-accent)' }}
            >
              {user?.firstName?.[0] ?? '?'}
            </div>
          )}
        </button>
      </Tooltip>
      {open && (
        <FixedDropdown anchorRef={ref} onClose={() => setOpen(false)}>
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false)
                onOpenSettings()
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors"
              style={{ color: 'var(--color-ink-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Settings size={14} /> Configurações
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-500 transition-colors"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.10)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Logout size={14} /> Sair
            </button>
          </div>
        </FixedDropdown>
      )}
    </div>
  )
}
