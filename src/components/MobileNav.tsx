'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings01 as Settings } from '@untitledui/icons'
import { IconFeed as Feed } from '@/components/icons'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = usePathname()

  const links = [
    { href: '/feed',     icon: Feed,     label: 'Feed'   },
    { href: '/settings', icon: Settings, label: 'Config' },
  ]

  return (
    <nav
      className="md:hidden fixed z-40 left-1/2 -translate-x-1/2 header-blur"
      style={{
        bottom: '34px',
        margin: '1rem 1rem 0',
        borderRadius: '9999px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 20%, transparent)',
        boxShadow: '0 8px 28px rgba(17, 17, 17, .035)',
      }}
    >
      <div className="flex items-center h-14">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href === '/feed' && pathname === '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-8 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors',
                active ? 'text-ink-primary' : 'text-ink-tertiary'
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
