'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Settings01 as Settings, LogOut01 as Logout } from '@untitledui/icons'

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
          className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]"
          style={{ animation: 'slideUp 0.12s ease' }}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink-primary">{user?.fullName}</p>
            <p className="truncate text-xs text-ink-tertiary">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false)
                onOpenSettings()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
            >
              <Settings size={14} /> Configurações
            </button>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#E5484D] transition-colors hover:bg-[#FFF1F2]"
            >
              <Logout size={14} /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
