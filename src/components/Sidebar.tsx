'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Newspaper, Settings, RefreshCw, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onRefresh?: () => void
  refreshing?: boolean
}

export function Sidebar({ onRefresh, refreshing }: Props) {
  const path = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col min-h-screen py-5 px-3 border-r border-border bg-bg-primary sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-7 h-7 rounded-lg bg-ink-primary flex items-center justify-center flex-shrink-0">
          <Newspaper size={14} className="text-white" />
        </div>
        <span className="font-display text-lg text-ink-primary">Lophos</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        <Link
          href="/feed"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            path === '/feed'
              ? 'bg-bg-secondary text-ink-primary font-medium'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
          )}
        >
          <BookOpen size={15} />
          Descobrir
        </Link>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 text-left"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Atualizar feed
          </button>
        )}

        <div className="mt-auto pt-4 border-t border-border">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              path === '/settings'
                ? 'bg-bg-secondary text-ink-primary font-medium'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
            )}
          >
            <Settings size={15} />
            Configurações
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="flex items-center gap-2.5 px-2 mt-4">
        <UserButton afterSignOutUrl="/login" />
        <span className="text-xs text-ink-tertiary truncate">Minha conta</span>
      </div>
    </aside>
  )
}
