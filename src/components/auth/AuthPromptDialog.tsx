'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XClose } from '@untitledui/icons'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'

export type AuthPromptMode = 'login' | 'signup'

export function AuthPromptDialog({
  mode,
  onModeChange,
  onClose,
}: {
  mode: AuthPromptMode
  onModeChange: (mode: AuthPromptMode) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="relative max-h-full w-full max-w-[500px] overflow-y-auto rounded-[28px] border border-border bg-white px-6 py-7 shadow-2xl sm:px-10 sm:py-9"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
        >
          <XClose size={18} />
        </button>

        <div className="mb-7 text-center">
          <h2 id="auth-prompt-title" className="px-10 text-[1.55rem] font-semibold tracking-[-0.035em] text-ink-primary">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta gratuita'}
          </h2>
          <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-6 text-ink-secondary">
            {mode === 'login'
              ? 'Entre para curtir notícias, ajustar seus interesses e deixar o feed com a sua cara.'
              : 'Crie sua conta gratuita para ter seu feed personalizado.'}
          </p>
        </div>

        {mode === 'login' ? (
          <LoginForm redirectUrlComplete="/" onRequestSignup={() => onModeChange('signup')} />
        ) : (
          <SignupForm onRequestLogin={() => onModeChange('login')} />
        )}
      </section>
    </div>,
    document.body,
  )
}
