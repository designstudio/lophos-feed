'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6A9.4 9.4 0 0 0 2.6 12c0 5.2 4.2 9.4 9.4 9.4 5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12Z"
      />
      <path
        fill="#34A853"
        d="M2.6 7.4l3.2 2.4A5.7 5.7 0 0 1 12 6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6a9.4 9.4 0 0 0-8.4 4.8Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.4c2.4 0 4.5-.8 6.1-2.3l-2.8-2.3c-.8.5-1.8.9-3.3.9-3.7 0-5.1-2.5-5.4-3.8l-3.2 2.4A9.4 9.4 0 0 0 12 21.4Z"
      />
      <path
        fill="#4285F4"
        d="M21 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.3-1.1 2.2-2.1 2.9l2.8 2.3c1.6-1.5 2.9-3.8 2.9-7.5Z"
      />
    </svg>
  )
}

type Step = 'email' | 'code'

export function LoginForm() {
  const router = useRouter()
  const { isLoaded, signIn, setActive } = useSignIn()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonLabel = useMemo(() => (step === 'email' ? 'Continue' : 'Verificar código'), [step])

  const handleGoogle = async () => {
    if (!isLoaded || !signIn) return

    setError(null)
    setIsSubmitting(true)

    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/login/sso-callback',
        redirectUrlComplete: '/feed',
      })
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || 'Não foi possível iniciar o login com Google.')
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded || !signIn || !setActive) return

    setError(null)
    setIsSubmitting(true)

    try {
      if (step === 'email') {
        const created = await signIn.create({ identifier: email })
        const factor = created.supportedFirstFactors?.find(
          (item): item is { strategy: 'email_code'; emailAddressId: string; safeIdentifier: string; primary?: boolean } =>
            item.strategy === 'email_code' && 'emailAddressId' in item
        )

        if (!factor) {
          throw new Error('O login por e-mail não está disponível no momento.')
        }

        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: factor.emailAddressId,
        })

        setStep('code')
      } else {
        const result = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code,
        })

        if (result.status !== 'complete' || !result.createdSessionId) {
          throw new Error('Não foi possível concluir o login.')
        }

        await setActive({ session: result.createdSessionId })
        router.push('/feed')
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Algo deu errado. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-white px-5 text-[1rem] font-medium text-ink-primary shadow-none transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[0.95rem] text-ink-tertiary">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 'email' ? (
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your e-mail address"
            className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-[1rem] text-ink-primary outline-none placeholder:text-ink-tertiary focus:border-ink-primary"
            required
          />
        ) : (
          <div className="space-y-3">
            <p className="text-[0.9rem] leading-6 text-ink-secondary">
              Enviamos um código para <span className="font-medium text-ink-primary">{email}</span>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter verification code"
              className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-[1rem] text-ink-primary outline-none placeholder:text-ink-tertiary focus:border-ink-primary"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isLoaded}
          className="h-12 w-full rounded-full bg-ink-primary text-[1rem] font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Carregando...' : buttonLabel}
        </button>
      </form>

      {error ? <p className="mt-4 text-center text-sm leading-6 text-red-500">{error}</p> : null}

      <div className="mt-5 text-center text-[0.75rem] leading-5 text-ink-tertiary">
        Ao continuar, você concorda com os{' '}
        <Link href="/politica-de-privacidade" className="text-ink-secondary underline underline-offset-2 transition-opacity hover:opacity-70">
          Termos e Políticas
        </Link>{' '}
        da Lophos.
      </div>

      <div className="mt-7 text-center text-[0.95rem] text-ink-secondary">
        Ainda não tem conta?{' '}
        <Link href="/signup" className="font-medium text-ink-primary transition-opacity hover:opacity-70">
          Criar conta grátis
        </Link>
      </div>
    </div>
  )
}
