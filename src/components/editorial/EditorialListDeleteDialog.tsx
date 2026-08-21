'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Trash01 } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useModalTransition } from '@/hooks/useModalTransition'

export function EditorialListDeleteDialog({
  title,
  isOpen,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  title: string
  isOpen: boolean
  deleting: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const transition = useModalTransition(isOpen)
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const deletingRef = useRef(deleting)
  const onCloseRef = useRef(onClose)
  deletingRef.current = deleting
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'unset'
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen])

  if (!transition.rendered || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn('article-report-backdrop', transition.open && 'is-open', transition.closing && 'is-closing')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={cn('article-report-modal t-modal max-w-md p-6', transition.open && 'is-open', transition.closing && 'is-closing')}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-hidden={!transition.open}
        inert={!transition.open}
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-danger-hover)] text-[var(--color-danger)]">
          <Trash01 size={21} aria-hidden="true" />
        </div>
        <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-ink-primary">Excluir lista permanentemente?</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink-secondary">
          A lista <strong className="font-medium text-ink-primary">“{title}”</strong> e suas reações serão apagadas. Esta ação não pode ser desfeita.
        </p>

        {error ? <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-danger)]" role="alert"><AlertCircle size={16} />{error}</p> : null}

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="editorial-secondary-button" onClick={onClose} disabled={deleting}>Cancelar</button>
          <button ref={confirmRef} type="button" className="editorial-destructive-button" onClick={onConfirm} disabled={deleting}>
            <Trash01 size={16} aria-hidden="true" />
            {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
