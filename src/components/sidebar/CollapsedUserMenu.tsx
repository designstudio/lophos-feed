'use client'
import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  Settings01 as Settings,
  LogOut01 as Logout,
  File06,
  ArrowNarrowUpRight,
  Announcement02,
  Key01,
  LogIn01,
} from '@untitledui/icons'
import { Tooltip } from '@/components/Tooltip'
import { UserAvatar } from '@/components/UserAvatar'
import { FixedDropdown } from './FixedDropdown'
import { useDropdownTransition } from '@/hooks/useDropdownTransition'
import { useAuthPrompt } from '@/components/auth/AuthPrompt'

export function CollapsedUserMenu({ onOpenSettings, isAdmin = false }: { onOpenSettings: () => void; isAdmin?: boolean }) {
  const { user, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { openAuthPrompt } = useAuthPrompt()
  const { open, closing, closeDropdown, toggleDropdown } = useDropdownTransition()
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [closeDropdown])

  return (
    <div ref={ref} className="relative">
      <Tooltip content={user?.firstName ?? 'Conta'} side="right">
        <button
          ref={triggerRef}
          onClick={toggleDropdown}
          aria-label="Abrir menu do usuário"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-bg-secondary"
        >
          <UserAvatar user={user} className="h-[26px] w-[26px] text-[10px]" />
        </button>
      </Tooltip>

      <FixedDropdown anchorRef={triggerRef} open={open} closing={closing}>
          <div>
            {isSignedIn ? <button
              onClick={() => {
                closeDropdown()
                onOpenSettings()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
            >
              <Settings size={14} />
              <span>Configurações</span>
            </button> : null}

            {isSignedIn && isAdmin ? (
              <Link
                href="/admin/lists"
                onClick={closeDropdown}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
              >
                <Key01 size={14} />
                <span>Admin</span>
              </Link>
            ) : null}

            <a
              href="/notas-de-versao"
              target="_blank"
              rel="noreferrer"
              onClick={closeDropdown}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
            >
              <Announcement02 size={14} />
              <span>Notas de versão</span>
              <ArrowNarrowUpRight size={14} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noreferrer"
              onClick={closeDropdown}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
            >
              <File06 size={14} />
              <span>Termos e políticas</span>
              <ArrowNarrowUpRight size={14} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
            </a>

            <div role="separator" className="my-1 border-t border-border" />

            {isSignedIn ? (
              <button
                onClick={() => { closeDropdown(); void signOut() }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-hover)]"
              >
                <Logout size={14} />
                <span>Sair</span>
              </button>
            ) : (
              <button
                onClick={() => { closeDropdown(); openAuthPrompt('login') }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-primary transition-colors hover:bg-[var(--color-hover-elevated)]"
              >
                <LogIn01 size={14} />
                <span>Login</span>
              </button>
            )}
          </div>
      </FixedDropdown>
    </div>
  )
}
