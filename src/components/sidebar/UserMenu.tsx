'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  Settings01 as Settings,
  LogOut01 as Logout,
  File06,
  ArrowNarrowUpRight,
  Announcement02,
} from '@untitledui/icons'
import { FixedDropdown } from './FixedDropdown'

export function UserMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg-secondary"
      >
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full flex-shrink-0" />
        ) : (
          <div
            className="h-[26px] w-[26px] rounded-full text-white text-xs font-semibold flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-accent)' }}
          >
            {user?.firstName?.[0] ?? '?'}
          </div>
        )}
        <span className="flex-1 truncate text-sm text-ink-secondary">{user?.firstName ?? 'Minha conta'}</span>
      </button>

      {open && (
        <FixedDropdown anchorRef={triggerRef} onClose={() => setOpen(false)}>
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
              <Settings size={14} />
              <span>Configurações</span>
            </button>

            <a
              href="/notas-de-versao"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
            >
              <Announcement02 size={14} />
              <span>Notas de versão</span>
              <ArrowNarrowUpRight size={14} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
            >
              <File06 size={14} />
              <span>Termos e políticas</span>
              <ArrowNarrowUpRight size={14} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#E5484D] transition-colors hover:bg-[#FFF1F2]"
            >
              <Logout size={14} />
              <span>Sair</span>
            </button>
          </div>
        </FixedDropdown>
      )}
    </div>
  )
}
