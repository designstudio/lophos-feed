'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MarketingFooter } from '@/components/landing/MarketingFooter'
import { MarketingHeader } from '@/components/landing/MarketingHeader'

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
  const pathname = usePathname()

  useEffect(() => {
    const shouldAnimate = sessionStorage.getItem('legal-page-animate') === '1'
    const storedScrollTop = Number(sessionStorage.getItem('legal-page-scroll-top') || '0')

    if (!shouldAnimate || !Number.isFinite(storedScrollTop) || storedScrollTop <= 16) {
      sessionStorage.removeItem('legal-page-animate')
      sessionStorage.removeItem('legal-page-scroll-top')
      return
    }

    window.scrollTo(0, storedScrollTop)

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      sessionStorage.removeItem('legal-page-animate')
      sessionStorage.removeItem('legal-page-scroll-top')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <MarketingHeader currentPath={currentPath} />

      <section className="px-5 pb-18 pt-28 md:px-8 md:pb-20 md:pt-32">
        <div className="mx-auto max-w-[980px]">
          <article className="mx-auto max-w-[760px]">
            <header className="mb-8 border-b border-border pb-6">
              <h1 className="font-display text-3xl leading-tight tracking-[-0.05em] md:text-5xl">{title}</h1>
              {updatedAt ? <p className="mt-3 text-sm text-ink-tertiary">Atualizado em {updatedAt}</p> : null}
              {subtitle ? <p className="mt-6 text-lg text-ink-tertiary">{subtitle}</p> : null}
              {intro ? <div className="mt-6 max-w-3xl text-body leading-relaxed text-ink-secondary">{intro}</div> : null}
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
      </section>

      <MarketingFooter />
    </main>
  )
}
