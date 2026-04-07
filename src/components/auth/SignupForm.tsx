'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSignUp } from '@clerk/nextjs'
import { GoogleIcon } from '@/components/auth/LoginForm'

type Step = 'email' | 'code'

export function SignupForm() {
  const router = useRouter()
  const { isLoaded, signUp, setActive } = useSignUp()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonLabel = useMemo(() => (step === 'email' ? 'Continuar' : 'Verificar código'), [step])

  const handleGoogle = async () => {
    if (!isLoaded || !signUp) return

    setError(null)
    setIsSubmitting(true)

    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/login/sso-callback',
        redirectUrlComplete: '/onboarding',
      })
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || 'Não foi possível iniciar o cadastro com Google.')
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded || !signUp || !setActive) return

    setError(null)
    setIsSubmitting(true)

    try {
      if (step === 'email') {
        await signUp.create({ emailAddress: email })
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setStep('code')
      } else {
        const result = await signUp.attemptEmailAddressVerification({ code })

        if (result.status !== 'complete' || !result.createdSessionId) {
          throw new Error('Não foi possível concluir o cadastro.')
        }

        await setActive({ session: result.createdSessionId })
        router.push('/onboarding')
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
        Continuar com o Google
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
            placeholder="Insira seu endereço de e-mail"
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
              placeholder="Insira o código de verificação"
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
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-ink-primary transition-opacity hover:opacity-70">
          Iniciar sessão
        </Link>
        .
      </div>
    </div>
  )
}
