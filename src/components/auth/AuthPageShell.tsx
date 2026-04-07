'use client'

import Link from 'next/link'
import { LophosLogo } from '@/components/LophosLogo'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'

type AuthMode = 'login' | 'signup'

export function AuthPageShell({ mode }: { mode: AuthMode }) {
  const isLogin = mode === 'login'

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-10 text-ink-primary">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[430px] items-center justify-center">
        <section className="w-full">
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center justify-center text-ink-primary">
              <LophosLogo size={42} />
            </Link>

            <h1 className="mt-8 text-[2rem] font-semibold leading-none tracking-[-0.05em] text-ink-primary">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta gratuita'}
            </h1>

            {!isLogin ? (
              <p className="mt-4 max-w-[390px] text-[1rem] leading-7 text-ink-secondary">
                Crie sua conta gratuita para ter seu feed personalizado. Não é necessário cartão de crédito.
              </p>
            ) : null}
          </div>

          <div className="mx-auto mt-12 w-full max-w-[430px]">
            {isLogin ? <LoginForm /> : <SignupForm />}
          </div>
        </section>
      </div>
    </main>
  )
}
