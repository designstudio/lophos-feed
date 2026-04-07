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
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-bg-secondary"
        >
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" width={26} height={26} className="rounded-full" />
          ) : (
            <div
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--color-accent)' }}
            >
              {user?.firstName?.[0] ?? '?'}
            </div>
          )}
        </button>
      </Tooltip>

      {open && (
        <FixedDropdown anchorRef={ref} onClose={() => setOpen(false)}>
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
