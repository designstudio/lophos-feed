'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import dynamic from 'next/dynamic'
import type { AuthPromptMode } from '@/components/auth/AuthPromptDialog'

type AuthPromptContextValue = { openAuthPrompt: (mode?: AuthPromptMode) => void }

const AuthPromptDialog = dynamic(
  () => import('@/components/auth/AuthPromptDialog').then((module) => module.AuthPromptDialog),
  { ssr: false },
)

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null)

export function useAuthPrompt() {
  const value = useContext(AuthPromptContext)
  if (!value) throw new Error('useAuthPrompt must be used inside AuthPromptProvider')
  return value
}

export function AuthPromptProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthPromptMode>('login')
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const openAuthPrompt = useCallback((nextMode: AuthPromptMode = 'login') => {
    void import('@/components/auth/AuthPromptDialog')
    setMode(nextMode)
    setOpen(true)
  }, [])

  return (
    <AuthPromptContext.Provider value={{ openAuthPrompt }}>
      {children}
      {open ? <AuthPromptDialog mode={mode} onModeChange={setMode} onClose={close} /> : null}
    </AuthPromptContext.Provider>
  )
}
