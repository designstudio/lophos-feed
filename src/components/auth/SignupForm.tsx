'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSignUp } from '@clerk/nextjs'
import { AppToast, type AppToastMessage } from '@/components/AppToast'
import { GoogleIcon } from '@/components/auth/LoginForm'
import { LiquidEmailField } from '@/components/auth/LiquidEmailField'

type Step = 'email' | 'code'

export function SignupForm({ onRequestLogin }: { onRequestLogin?: () => void } = {}) {
  const router = useRouter()
  const { isLoaded, signUp, setActive } = useSignUp()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<AppToastMessage | null>(null)

  const buttonLabel = useMemo(() => (step === 'email' ? 'Continuar' : 'Verificar código'), [step])

  const handleGoogle = async () => {
    if (!isLoaded || !signUp) return

    setToast(null)
    setIsSubmitting(true)

    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/login/sso-callback',
        redirectUrlComplete: '/onboarding',
      })
    } catch (err: any) {
      setToast({ type: 'error', text: err?.errors?.[0]?.longMessage || 'Não foi possível iniciar o cadastro com Google.' })
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLoaded || !signUp || !setActive) return

    setToast(null)
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
      setToast({ type: 'error', text: err?.errors?.[0]?.longMessage || err?.message || 'Algo deu errado. Tente novamente.' })
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
        className="auth-google-button flex h-12 items-center justify-center gap-3 rounded-full bg-[var(--input-bg)] px-5 text-[1rem] font-medium text-ink-primary transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
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
          <LiquidEmailField
            value={email}
            onChange={setEmail}
            disabled={isSubmitting || !isLoaded}
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
              className="app-input h-12 w-full rounded-2xl border border-border bg-white px-4 text-[1rem] text-ink-primary outline-none placeholder:text-ink-tertiary"
              required
            />
          </div>
        )}

        {step === 'code' ? (
          <button
            type="submit"
            disabled={isSubmitting || !isLoaded}
            className="h-12 w-full rounded-full bg-ink-primary text-[1rem] font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Carregando...' : buttonLabel}
          </button>
        ) : null}
      </form>

      <AppToast message={toast} onDismiss={() => setToast(null)} />

      <div className="mt-5 text-center text-[0.75rem] leading-5 text-ink-tertiary">
        <span className="block">
          Ao continuar, você concorda com os{' '}
          <Link href="/termos-de-uso" className="text-ink-secondary underline underline-offset-2 transition-opacity hover:opacity-70">
            Termos de Uso
          </Link>
        </span>
        <span className="block">
          e com a{' '}
          <Link href="/politica-de-privacidade" className="text-ink-secondary underline underline-offset-2 transition-opacity hover:opacity-70">
            Política de Privacidade
          </Link>{' '}
          do Lophos.
        </span>
      </div>

      <div className="mt-7 text-center text-[0.95rem] text-ink-secondary">
        Já tem uma conta?{' '}
        {onRequestLogin ? (
          <button type="button" onClick={onRequestLogin} className="font-medium text-ink-primary transition-opacity hover:opacity-70">Iniciar sessão</button>
        ) : (
          <Link href="/login" className="font-medium text-ink-primary transition-opacity hover:opacity-70">Iniciar sessão</Link>
        )}
        .
      </div>
    </div>
  )
}
