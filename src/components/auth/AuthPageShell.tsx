'use client'

import Link from 'next/link'
import { ClerkProvider, SignIn, SignUp } from '@clerk/nextjs'
import { LophosLogo } from '@/components/LophosLogo'

type AuthMode = 'login' | 'signup'

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full',
    card: 'w-full border-0 bg-transparent shadow-none p-0',
    header: 'hidden',
    footer: 'hidden',
    form: 'space-y-4',
    formFieldLabel: 'text-[0.92rem] font-medium text-ink-primary',
    formFieldInput:
      'h-12 rounded-2xl border border-border bg-white px-4 text-[0.98rem] text-ink-primary shadow-none focus:border-ink-primary focus:ring-0',
    formButtonPrimary:
      'h-12 rounded-full bg-ink-primary text-[0.98rem] font-medium text-white shadow-none transition-opacity hover:opacity-85',
    socialButtonsBlockButton:
      'h-12 rounded-full border border-border bg-white text-[0.98rem] font-medium text-ink-primary shadow-none transition-opacity hover:opacity-85',
    socialButtonsBlockButtonText: 'font-medium text-ink-primary',
    dividerLine: 'bg-border',
    dividerText: 'text-[0.88rem] text-ink-tertiary',
    formFieldErrorText: 'text-sm text-red-500',
    footerActionLink: 'text-ink-primary hover:opacity-70',
    identityPreviewText: 'text-ink-secondary',
    formResendCodeLink: 'text-ink-primary hover:opacity-70',
    otpCodeFieldInput:
      'h-12 w-12 rounded-2xl border border-border bg-white text-ink-primary shadow-none focus:border-ink-primary focus:ring-0',
    alertText: 'text-sm',
    alert: 'rounded-2xl',
  },
} as const

const loginLocalization = {
  locale: 'pt-BR',
  dividerText: 'ou',
  formFieldLabel__emailAddress: ' ',
  formFieldInputPlaceholder__emailAddress: 'Enter your e-mail address',
  formButtonPrimary: 'Continue',
} as const

export function AuthPageShell({ mode }: { mode: AuthMode }) {
  const isLogin = mode === 'login'

  if (isLogin) {
    return (
      <main className="min-h-screen bg-bg-primary px-4 py-10 text-ink-primary">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[430px] items-center justify-center">
          <section className="w-full">
            <div className="flex flex-col items-center text-center">
              <Link href="/" className="inline-flex items-center justify-center text-ink-primary">
                <LophosLogo size={42} />
              </Link>

              <h1 className="mt-8 text-[2rem] font-semibold leading-none tracking-[-0.05em] text-ink-primary">
                Bem-vindo de volta
              </h1>
            </div>

            <div className="mx-auto mt-12 w-full max-w-[430px]">
              <ClerkProvider localization={loginLocalization}>
                <SignIn
                  routing="path"
                  path="/login"
                  signUpUrl="/signup"
                  forceRedirectUrl="/feed"
                  appearance={{
                    elements: {
                      ...clerkAppearance.elements,
                      rootBox: 'w-full',
                      socialButtonsBlockButton:
                        'h-12 rounded-full border border-border bg-white px-4 text-[0.98rem] font-medium text-ink-primary shadow-none transition-opacity hover:opacity-85',
                      socialButtonsBlockButtonText: 'font-medium text-ink-primary',
                      socialButtonsProviderIcon: 'h-5 w-5',
                      alternativeMethods: 'hidden',
                      alternativeMethodsBlockButton: 'hidden',
                      alternativeMethodsBlockButtonText: 'hidden',
                      dividerRow: 'my-5',
                      dividerText: 'px-4 text-[0.95rem] text-ink-tertiary',
                      dividerLine: 'bg-border',
                      formFieldRow: 'mt-0',
                      formFieldLabelRow: 'hidden',
                      formFieldLabel: 'hidden',
                      formFieldInput:
                        'h-12 rounded-2xl border border-border bg-white px-4 text-[0.98rem] text-ink-primary shadow-none placeholder:text-ink-tertiary focus:border-ink-primary focus:ring-0',
                      formButtonPrimary:
                        'mt-4 h-12 rounded-full bg-ink-primary text-[0.98rem] font-medium text-white shadow-none transition-opacity hover:opacity-85',
                    },
                  }}
                />
              </ClerkProvider>
            </div>

            <p className="mx-auto mt-5 max-w-[420px] text-center text-[0.75rem] leading-5 text-ink-tertiary">
              Ao continuar, você concorda com os{' '}
              <Link href="/politica-de-privacidade" className="text-ink-secondary underline underline-offset-2 transition-opacity hover:opacity-70">
                Termos e Políticas
              </Link>{' '}
              da Lophos.
            </p>

            <div className="mt-7 text-center text-[0.95rem] text-ink-secondary">
              Ainda não tem conta?{' '}
              <Link href="/signup" className="font-medium text-ink-primary transition-opacity hover:opacity-70">
                Criar conta grátis
              </Link>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-10 text-ink-primary">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[560px] items-center justify-center">
        <section className="w-full rounded-[32px] border border-border bg-bg-secondary px-6 py-8 shadow-[0_24px_60px_rgba(17,17,17,0.04)] md:px-10 md:py-10">
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-flex items-center gap-3 text-ink-primary">
              <LophosLogo size={38} />
              <span className="text-[1.2rem] font-semibold tracking-[-0.05em]">Lophos</span>
            </Link>

            <h1 className="mt-8 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.06em] text-ink-primary">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta grátis'}
            </h1>

            <p className="mt-3 max-w-[420px] text-[1.02rem] leading-7 text-ink-secondary">
              {isLogin
                ? 'Entre para continuar acompanhando o que importa, com contexto e sem repetição.'
                : 'Comece a organizar seu feed com notícias consolidadas, contexto e threads prontas para explorar.'}
            </p>
          </div>

          <div className="mx-auto mt-10 w-full max-w-[380px]">
            {isLogin ? (
              <SignIn
                routing="path"
                path="/login"
                signUpUrl="/signup"
                forceRedirectUrl="/feed"
                appearance={clerkAppearance}
              />
            ) : (
              <SignUp
                routing="path"
                path="/signup"
                signInUrl="/login"
                forceRedirectUrl="/onboarding"
                appearance={clerkAppearance}
              />
            )}
          </div>

          <div className="mt-8 text-center text-[0.95rem] text-ink-secondary">
            {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}{' '}
            <Link href={isLogin ? '/signup' : '/login'} className="font-medium text-ink-primary transition-opacity hover:opacity-70">
              {isLogin ? 'Criar conta grátis' : 'Entrar'}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-ink-tertiary">
            <Link href="/termos-de-uso" className="transition-opacity hover:opacity-70">
              Termos de Uso
            </Link>
            <span className="text-border-strong">•</span>
            <Link href="/politica-de-privacidade" className="transition-opacity hover:opacity-70">
              Política de Privacidade
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
