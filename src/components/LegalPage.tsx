'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LophosLogo } from '@/components/LophosLogo'
import { cn } from '@/lib/utils'

export function LegalPage({
  title,
  updatedAt,
  currentPath,
  children,
}: {
  title: string
  updatedAt: string
  currentPath: '/termos-de-uso' | '/politica-de-privacidade'
  children: React.ReactNode
}) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const links = [
    { href: '/politica-de-privacidade' as const, label: 'Política de Privacidade' },
    { href: '/termos-de-uso' as const, label: 'Termos de Uso' },
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

  const navigateTo = (href: '/termos-de-uso' | '/politica-de-privacidade') => {
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
    <main className="flex h-[100dvh] min-h-[100dvh] flex-1 min-w-0 overflow-hidden bg-bg-primary text-ink-primary">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto min-w-0">
        <div className="sticky top-0 z-20 border-b border-border header-blur">
          <div className="flex items-center h-12 px-4 md:hidden gap-2">
            <LophosLogo size={26} />
            <h1 className="text-[15px] font-semibold text-ink-primary">Lophos</h1>
          </div>

          <div className="flex md:hidden overflow-x-auto no-scrollbar gap-2 px-4 pb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {links.map((link) => {
              const active = currentPath === link.href
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={cn(
                    'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                    active
                      ? 'bg-ink-primary text-bg-primary border-ink-primary'
                      : 'border-border text-ink-tertiary hover:text-ink-secondary'
                  )}
                >
                  {link.label}
                </button>
              )
            })}
          </div>

          <div className="hidden md:flex items-center h-14 px-8">
            <div className="flex items-center gap-2 flex-shrink-0" style={{ width: '12rem' }}>
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
                      'text-[0.875rem] px-4 h-14 border-b-2 transition-all font-medium flex items-center',
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
              <p className="mt-3 text-sm text-ink-tertiary">Atualizado em {updatedAt}</p>
            </header>

            <div className="space-y-8 text-body text-ink-secondary [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink-primary [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-primary [&_h3]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2">
              {children}
            </div>
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
