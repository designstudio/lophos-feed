'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings01 as Settings } from '@untitledui/icons'
import { IconFeed as Feed } from '@/components/icons'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = usePathname()

  const links = [
    { href: '/feed',     icon: Feed,     label: 'Meu feed'      },
    { href: '/settings', icon: Settings, label: 'Configurações' },
  ]

  return (
    <nav
      className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 header-blur"
      style={{
        bottom: '18px',
        borderRadius: '9999px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 20%, transparent)',
        boxShadow: '0 8px 28px rgba(17, 17, 17, .035)',
      }}
    >
      <div className="flex items-center gap-1 px-2 h-14">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href === '/feed' && pathname === '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-6 py-1.5 text-[10px] font-semibold transition-colors rounded-full whitespace-nowrap',
                active ? 'text-ink-primary' : 'text-ink-tertiary'
              )}
              style={active ? { backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 20%, transparent)' } : undefined}
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
