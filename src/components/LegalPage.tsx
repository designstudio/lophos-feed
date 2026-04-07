'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LophosLogo } from '@/components/LophosLogo'
import { cn } from '@/lib/utils'

type LegalPath = '/termos-de-uso' | '/politica-de-privacidade' | '/notas-de-versao'

export function LegalPage({
  title,
  updatedAt,
  subtitle,
  intro,
  currentPath,
  contentClassName,
  unstyledContent = false,
  children,
}: {
  title: string
  updatedAt?: string
  subtitle?: string
  intro?: React.ReactNode
  currentPath: LegalPath
  contentClassName?: string
  unstyledContent?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const links: Array<{ href: LegalPath; label: string }> = [
    { href: '/politica-de-privacidade', label: 'Política de Privacidade' },
    { href: '/termos-de-uso', label: 'Termos de Uso' },
    { href: '/notas-de-versao', label: 'Notas de versão' },
  ]

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    const shouldAnimate = sessionStorage.getItem('legal-page-animate') === '1'
    const storedScrollTop = Number(sessionStorage.getItem('legal-page-scroll-top') || '0')

    if (!shouldAnimate || !Number.isFinite(storedScrollTop) || storedScrollTop <= 16) {
      sessionStorage.removeItem('legal-page-animate')
      sessionStorage.removeItem('legal-page-scroll-top')
      return
    }

    scroller.scrollTop = storedScrollTop

    const frame = window.requestAnimationFrame(() => {
      scroller.scrollTo({ top: 0, behavior: 'smooth' })
      sessionStorage.removeItem('legal-page-animate')
      sessionStorage.removeItem('legal-page-scroll-top')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [currentPath])

  const navigateTo = (href: LegalPath) => {
    if (href === currentPath) return

    const scroller = scrollRef.current

    if (!scroller) {
      router.push(href)
      return
    }

    sessionStorage.setItem('legal-page-scroll-top', String(scroller.scrollTop))
    sessionStorage.setItem('legal-page-animate', '1')
    router.push(href)
  }

  return (
    <main className="flex h-[100dvh] min-h-[100dvh] min-w-0 flex-1 overflow-hidden bg-bg-primary text-ink-primary">
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="header-blur sticky top-0 z-20 border-b border-border">
          <div className="flex h-12 items-center gap-2 px-4 md:hidden">
            <LophosLogo size={26} />
            <h1 className="text-[15px] font-semibold text-ink-primary">Lophos</h1>
          </div>

          <div
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 md:hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {links.map((link) => {
              const active = currentPath === link.href
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={cn(
                    'flex-shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                    active
                      ? 'border-ink-primary bg-ink-primary text-bg-primary'
                      : 'border-border text-ink-tertiary hover:text-ink-secondary'
                  )}
                >
                  {link.label}
                </button>
              )
            })}
          </div>

          <div className="hidden h-14 items-center px-8 md:flex">
            <div className="flex flex-shrink-0 items-center gap-2" style={{ width: '12rem' }}>
              <LophosLogo size={26} />
              <span className="text-[15px] font-semibold text-ink-primary">Lophos</span>
            </div>

            <div className="flex flex-1 justify-center">
              {links.map((link) => {
                const active = currentPath === link.href
                return (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => navigateTo(link.href)}
                    className={cn(
                      'flex h-14 items-center border-b-2 px-4 text-[0.875rem] font-medium transition-all',
                      active
                        ? 'border-ink-primary text-ink-primary'
                        : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
                    )}
                  >
                    {link.label}
                  </button>
                )
              })}
            </div>

            <div style={{ width: '12rem' }} />
          </div>
        </div>

        <div className="article-layout mx-auto px-6 py-6 pb-12 md:px-6 md:py-8">
          <article className="px-0 py-8 md:py-10">
            <header className="mb-8 border-b border-border pb-6">
              <h1 className="font-display text-3xl leading-tight md:text-4xl">{title}</h1>
              {subtitle ? <p className="mt-3 text-base text-ink-tertiary">{subtitle}</p> : null}
              {intro ? <div className="mt-8 max-w-3xl text-body leading-relaxed text-ink-secondary">{intro}</div> : null}
              {updatedAt ? <p className="mt-3 text-sm text-ink-tertiary">Atualizado em {updatedAt}</p> : null}
            </header>

            {unstyledContent ? (
              <div className={contentClassName}>{children}</div>
            ) : (
              <div
                className={cn(
                  'space-y-8 text-body text-ink-secondary [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink-primary [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-primary [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
                  contentClassName
                )}
              >
                {children}
              </div>
            )}
          </article>
        </div>

        <footer className="w-full border-t border-border px-6 py-8 md:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-center">
            <p className="text-sm text-ink-tertiary">Lophos © 2026</p>
          </div>
        </footer>
      </div>
    </main>
  )
}
