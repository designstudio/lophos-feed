import Link from 'next/link'

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-bg-primary text-ink-primary">
      <div className="mx-auto max-w-4xl px-6 py-8 md:px-8 md:py-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href="/login"
            className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
          >
            Voltar
          </Link>
          <p className="text-sm text-ink-tertiary">Atualizado em {updatedAt}</p>
        </div>

        <article className="rounded-[1.5rem] border border-border bg-white px-6 py-8 shadow-sm md:px-10 md:py-10">
          <header className="mb-8 border-b border-border pb-6">
            <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
              Lophos
            </p>
            <h1 className="font-display text-3xl leading-tight md:text-4xl">{title}</h1>
          </header>

          <div className="space-y-8 text-body text-ink-secondary [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink-primary [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-primary [&_h3]:mb-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2">
            {children}
          </div>
        </article>
      </div>
    </main>
  )
}
