'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings01 as Settings } from '@untitledui/icons'
import { LogIn01 } from '@untitledui/icons'
import { useAuth } from '@clerk/nextjs'
import { useAuthPrompt } from '@/components/auth/AuthPrompt'
import { IconFeed as Feed } from '@/components/icons'
import { IconLists } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useHydrated } from '@/hooks/useHydrated'

export function MobileNav() {
  const pathname = usePathname()
  const { isSignedIn } = useAuth()
  const signedIn = useHydrated() && Boolean(isSignedIn)
  const { openAuthPrompt } = useAuthPrompt()
  const dockedLayout = pathname.startsWith('/article/') || pathname.startsWith('/lists/')
  const isFeedActive = pathname === '/feed' || pathname === '/'
  const isSettingsActive = pathname === '/settings'
  const isListsActive = pathname === '/lists'

  return (
    <nav
      className={
        dockedLayout
          ? 'md:hidden fixed left-4 z-40 header-blur'
          : 'md:hidden fixed left-1/2 -translate-x-1/2 z-40 header-blur'
      }
      style={{
        bottom: 'max(14px, env(safe-area-inset-bottom))',
        borderRadius: '9999px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 92%, transparent)',
        boxShadow: '0 14px 35px rgba(17, 17, 17, .08)',
      }}
    >
      <div
        className={dockedLayout ? 'flex h-14 w-14 items-center justify-center p-0' : 'flex items-center gap-1 h-14'}
        style={dockedLayout ? undefined : { paddingLeft: '0.2rem', paddingRight: '0.2rem' }}
      >
        <Link
          href="/"
          className={cn(
            dockedLayout
              ? 'flex h-14 w-14 items-center justify-center rounded-full transition-colors'
              : 'flex flex-col items-center gap-0.5 px-6 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
            isFeedActive ? 'text-ink-primary' : 'text-ink-tertiary'
          )}
          style={
            isFeedActive
              ? { backgroundColor: 'var(--color-bg-secondary)' }
              : undefined
          }
        >
          <Feed size={20} />
          {!dockedLayout && (signedIn ? 'Meu feed' : 'Feed')}
        </Link>

        {!dockedLayout && (
          <Link
            href="/lists"
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
              isListsActive ? 'text-ink-primary' : 'text-ink-tertiary'
            )}
            style={isListsActive ? { backgroundColor: 'var(--color-bg-secondary)' } : undefined}
          >
            <IconLists size={20} />
            Listas
          </Link>
        )}

        {!dockedLayout && (
          signedIn ? <Link
            href="/settings"
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
              isSettingsActive ? 'text-ink-primary' : 'text-ink-tertiary'
            )}
            style={
              isSettingsActive
                ? { backgroundColor: 'var(--color-bg-secondary)' }
                : undefined
            }
          >
            <Settings size={20} />
            Configurações
          </Link> : <button
            type="button"
            onClick={() => openAuthPrompt('login')}
            className="flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-[10px] font-semibold text-ink-tertiary transition-colors whitespace-nowrap"
          >
            <LogIn01 size={20} />
            Login
          </button>
        )}
      </div>
    </nav>
  )
}
