'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path fill="#4285f4" d="M23.5151 12.2611c0 -0.9661 -0.0784 -1.6711 -0.24805 -2.4022H12.2351v4.3605h6.4755c-0.1305 1.08365 -0.8355 2.7156 -2.4022 3.8122l-0.02195 0.146 3.4881 2.702175 0.24165 0.024125c2.2194 -2.04975 3.4989 -5.0656 3.4989 -8.6428Z" strokeWidth="0.25" />
      <path fill="#34a853" d="M12.234975 23.75c3.17245 0 5.83575 -1.0445 7.7811 -2.8461L16.308275 18.031625c-0.9922 0.69195 -2.3239 1.175 -4.0733 1.175 -3.1072 0 -5.7444 -2.049675 -6.6845 -4.882725l-0.137775 0.0117L1.7857125 17.14255l-0.0474325 0.13185C3.670475 21.112725 7.639375 23.75 12.234975 23.75Z" strokeWidth="0.25" />
      <path fill="#fbbc05" d="M5.550625 14.3239c-0.248075 -0.7311 -0.391625 -1.5145 -0.391625 -2.3239 0 -0.8095 0.143575 -1.5928 0.378575 -2.3239l-0.006575 -0.1557L1.858565 6.66835l-0.120155 0.05715C0.9420575 8.3183 0.4851075 10.10695 0.4851075 12c0 1.89305 0.45695 3.6816 1.2533025 5.2744l3.812215 -2.9505Z" strokeWidth="0.25" />
      <path fill="#eb4335" d="M12.234975 4.7933c2.20635 0 3.69465 0.95305 4.5433 1.7495L20.094375 3.305C18.057775 1.41195 15.407425 0.25 12.234975 0.25 7.639375 0.25 3.670475 2.8872 1.73828 6.7255L5.537425 9.6761c0.95315 -2.83305 3.59035 -4.8828 6.69755 -4.8828Z" strokeWidth="0.25" />
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
