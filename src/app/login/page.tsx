import { SignIn } from '@clerk/nextjs'

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
    </div>
  )
}
