'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Feed, Settings } from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const pathname = usePathname()

  const links = [
    { href: '/feed',     icon: Feed,     label: 'Feed'   },
    { href: '/settings', icon: Settings, label: 'Config' },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border header-blur"
    >
      <div className="flex items-center justify-around h-14">
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
