'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LophosLogo } from '@/components/LophosLogo'
import { cn } from '@/lib/utils'

type LegalPath = '/termos-de-uso' | '/politica-de-privacidade' | '/notas-de-versao'

const legalLinks: Array<{ href: LegalPath; label: string }> = [
  { href: '/politica-de-privacidade', label: 'Política de Privacidade' },
  { href: '/termos-de-uso', label: 'Termos de Uso' },
  { href: '/notas-de-versao', label: 'Notas de versão' },
]

export function MarketingHeader({ currentPath }: { currentPath?: LegalPath }) {
  const router = useRouter()
  const [showSignup, setShowSignup] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setShowSignup(window.scrollY > 24)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navigateTo = (href: LegalPath) => {
    if (href === currentPath) return

    sessionStorage.setItem('legal-page-scroll-top', String(window.scrollY))
    sessionStorage.setItem('legal-page-animate', '1')
    router.push(href, { scroll: false })
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-40 flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto header-blur flex h-[60px] w-full items-center justify-between rounded-full border border-border px-5 shadow-[0_12px_40px_rgba(17,17,17,0.05)] transition-[max-width] duration-300',
          currentPath ? 'max-w-[72rem]' : 'max-w-[44rem]'
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-3 text-ink-primary">
          <LophosLogo size={30} />
          <span className="text-[1.05rem] font-semibold tracking-[-0.04em]">Lophos</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 md:gap-6">
          {currentPath ? (
            <div
              className={cn(
                'hidden items-center gap-5 text-[0.92rem] font-medium text-ink-secondary transition-transform duration-300 md:flex',
                showSignup ? '-translate-x-2' : 'translate-x-0'
              )}
            >
              {legalLinks.map((link) => {
                const active = currentPath === link.href
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => navigateTo(link.href)}
                    className={cn(
                      'whitespace-nowrap transition-opacity',
                      active ? 'text-ink-primary' : 'hover:opacity-65'
                    )}
                  >
                    {link.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div
            className={cn(
              'flex items-center gap-3 transition-transform duration-300',
              showSignup ? '-translate-x-2' : 'translate-x-0'
            )}
          >
            <Link
              href="/login"
              className="whitespace-nowrap text-[0.92rem] font-medium text-ink-secondary transition-opacity hover:opacity-65"
            >
              Entrar
            </Link>

            <Link
              href="/signup"
              className={cn(
                'inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-full bg-ink-primary text-[0.95rem] font-medium text-white transition-all duration-300 hover:opacity-85',
                showSignup
                  ? 'max-w-[220px] translate-y-0 px-4 py-2 opacity-100'
                  : 'pointer-events-none max-w-0 translate-y-3 px-0 py-0 opacity-0'
              )}
              aria-hidden={!showSignup}
              tabIndex={showSignup ? 0 : -1}
            >
              Criar conta grátis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
