export const dynamic = 'force-dynamic'

import dynamic from 'next/dynamic'

const SignInClient = dynamic(
  () => import('@/components/SignInClient').then((m) => m.SignInClient),
  { ssr: false }
)

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-ink-primary mb-2">Lophos Feed</h1>
        <p className="text-ink-secondary text-sm">Seu feed de notícias personalizado por IA</p>
      </div>
      <SignInClient />
    </div>
  )
}
