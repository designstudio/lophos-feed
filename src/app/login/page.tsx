'use client'
import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ink-primary mb-2">Lophos Feed</h1>
        <p className="text-ink-secondary text-sm">Seu feed de notícias personalizado por IA</p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'shadow-none border border-border rounded-2xl bg-white',
            headerTitle: 'font-display text-xl',
            formButtonPrimary: 'bg-accent hover:bg-blue-700 text-white',
          },
        }}
      />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-ink-tertiary">
        <Link href="/termos-de-uso" className="transition-colors hover:text-ink-primary">
          Termos de Uso
        </Link>
        <span className="text-border-strong">•</span>
        <Link href="/politica-de-privacidade" className="transition-colors hover:text-ink-primary">
          Política de Privacidade
        </Link>
      </div>
    </div>
  )
}
