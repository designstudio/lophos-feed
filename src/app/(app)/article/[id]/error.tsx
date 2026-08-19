'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw01 } from '@untitledui/icons'

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[article] route error:', error)
  }, [error])

  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center" role="alert">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-ink-secondary">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
          Não foi possível abrir a matéria
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          A conexão pode ter oscilado. Tente carregar novamente sem perder o seu lugar no feed.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--color-ui-strong)] px-4 text-sm font-medium text-[var(--color-tooltip-ink)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2"
          >
            <RefreshCw01 size={16} aria-hidden="true" />
            Tentar novamente
          </button>
          <Link
            href="/feed"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2"
          >
            Voltar ao feed
          </Link>
        </div>
      </div>
    </main>
  )
}
