'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings01 as Settings } from '@untitledui/icons'
import { IconFeed as Feed } from '@/components/icons'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = usePathname()
  const dockedLayout = pathname.startsWith('/article/') || pathname.startsWith('/threads/')
  const isFeedActive = pathname === '/feed' || pathname === '/'
  const isSettingsActive = pathname === '/settings'

  return (
    <nav
      className={
        dockedLayout
          ? 'md:hidden fixed left-4 z-40 header-blur'
          : 'md:hidden fixed left-1/2 -translate-x-1/2 z-40 header-blur'
      }
      style={{
        bottom: '18px',
        borderRadius: '9999px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 20%, transparent)',
        boxShadow: '0 8px 28px rgba(17, 17, 17, .035)',
      }}
    >
      <div
        className={dockedLayout ? 'flex h-14 w-14 items-center justify-center p-0' : 'flex items-center gap-1 h-14'}
        style={dockedLayout ? undefined : { paddingLeft: '0.2rem', paddingRight: '0.2rem' }}
      >
        <Link
          href="/feed"
          className={cn(
            dockedLayout
              ? 'flex h-14 w-14 items-center justify-center rounded-full transition-colors'
              : 'flex flex-col items-center gap-0.5 px-6 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
            isFeedActive ? 'text-ink-primary' : 'text-ink-tertiary'
          )}
          style={
            isFeedActive
              ? { backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 20%, transparent)' }
              : undefined
          }
        >
          <Feed size={20} />
          {!dockedLayout && 'Meu feed'}
        </Link>

        {!dockedLayout && (
          <Link
            href="/settings"
            className={cn(
              'flex flex-col items-center gap-0.5 px-6 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
              isSettingsActive ? 'text-ink-primary' : 'text-ink-tertiary'
            )}
            style={
              isSettingsActive
                ? { backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 20%, transparent)' }
                : undefined
            }
          >
            <Settings size={20} />
            Configurações
          </Link>
        )}
      </div>
    </nav>
  )
}
