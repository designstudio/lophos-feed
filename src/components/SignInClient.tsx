'use client'
import { SignIn } from '@clerk/nextjs'

export function SignInClient() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: 'w-full max-w-sm',
          card: 'shadow-none border border-border rounded-[1.5rem] bg-white',
          headerTitle: 'font-display text-xl',
          formButtonPrimary: 'bg-ink-primary text-bg-primary hover:opacity-85',
        },
      }}
    />
  )
}
