'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Settings, Logout } from '@solar-icons/react-perf/Linear'

export function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-full hover:bg-bg-secondary transition-colors text-left"
      >
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full flex-shrink-0" />
        ) : (
          <div
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            {user?.firstName?.[0] ?? '?'}
          </div>
        )}
        <span className="text-sm text-ink-secondary truncate flex-1">{user?.firstName ?? 'Minha conta'}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-56 rounded-xl shadow-xl z-50 py-1"
          style={{
            animation: 'slideUp 0.12s ease',
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)'
          }}
        >
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
        </div>
      )}
    </div>
  )
}
