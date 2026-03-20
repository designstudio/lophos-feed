'use client'
import { SignIn } from '@clerk/nextjs'

export function SignInClient() {
  return (
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
  )
}
