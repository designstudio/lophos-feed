'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle } from '@untitledui/icons'
import { cn } from '@/lib/utils'

export type AppToastMessage = { type: 'success' | 'error'; text: string }

export function AppToast({ message, onDismiss }: {
  message: AppToastMessage | null
  onDismiss: () => void
}) {
  const [renderedMessage, setRenderedMessage] = useState<AppToastMessage | null>(null)
  const [open, setOpen] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => dismissRef.current(), 3500)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    let frame = 0
    let timeout = 0
    if (message) {
      setRenderedMessage(message)
      setOpen(false)
      frame = window.requestAnimationFrame(() => setOpen(true))
    } else {
      setOpen(false)
      const closeDuration = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--toast-close')) || 250
      timeout = window.setTimeout(() => setRenderedMessage(null), closeDuration)
    }
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [message])

  if (!renderedMessage) return null

  return (
    <div className="app-toast-viewport">
      <div
        className={cn('app-toast t-toast', open && 'is-open', renderedMessage.type === 'error' && 'app-toast--error')}
        role={renderedMessage.type === 'error' ? 'alert' : 'status'}
        aria-live={renderedMessage.type === 'error' ? 'assertive' : 'polite'}
      >
        {renderedMessage.type === 'error'
          ? <AlertCircle size={18} aria-hidden="true" />
          : <CheckCircle size={18} aria-hidden="true" />}
        <span>{renderedMessage.text}</span>
      </div>
    </div>
  )
}
