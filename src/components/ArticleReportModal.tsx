'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle, X as CloseIcon } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useModalTransition } from '@/hooks/useModalTransition'

export const ARTICLE_REPORT_CATEGORIES = [
  { value: 'incorrect_information', label: 'Informação incorreta' },
  { value: 'title_or_summary', label: 'Título ou resumo' },
  { value: 'source_or_link', label: 'Fonte ou link' },
  { value: 'image_or_video', label: 'Imagem ou vídeo' },
  { value: 'duplicate', label: 'Matéria duplicada' },
  { value: 'other', label: 'Outro problema' },
] as const

type ReportCategory = (typeof ARTICLE_REPORT_CATEGORIES)[number]['value']

interface ArticleReportModalProps {
  articleId: string
  articleTitle: string
  isOpen: boolean
  onClose: () => void
}

export function ArticleReportModal({ articleId, articleTitle, isOpen, onClose }: ArticleReportModalProps) {
  const transition = useModalTransition(isOpen)
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const [category, setCategory] = useState<ReportCategory | ''>('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const statusRef = useRef(status)
  statusRef.current = status

  const resetForm = () => {
    setCategory('')
    setDescription('')
    setStatus('idle')
    setErrorMessage('')
  }

  const close = () => {
    if (statusRef.current === 'sending') return
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
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

  useEffect(() => {
    if (!transition.rendered) resetForm()
  }, [transition.rendered])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!category || description.trim().length < 10 || status === 'sending') return

    setStatus('sending')
    setErrorMessage('')
    try {
      const response = await fetch('/api/article-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, category, description: description.trim() }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'Não foi possível enviar o reporte.')
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar o reporte.')
    }
  }

  if (!transition.rendered || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn('article-report-backdrop', transition.open && 'is-open', transition.closing && 'is-closing')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        className={cn('article-report-modal t-modal', transition.open && 'is-open', transition.closing && 'is-closing')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!transition.open}
        inert={!transition.open}
      >
        {status === 'success' ? (
          <div className="article-report-success" role="status">
            <span className="article-report-success__icon"><CheckCircle size={24} /></span>
            <h2 id={titleId}>Reporte recebido</h2>
            <p>Obrigado por ajudar a manter as matérias do Lophos precisas. Nossa equipe vai revisar este conteúdo.</p>
            <button type="button" className="article-report-primary" onClick={close}>Concluir</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <header className="article-report-header">
              <div>
                <h2 id={titleId}>Reportar um problema</h2>
                <p title={articleTitle}>{articleTitle}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={close} aria-label="Fechar reporte" disabled={status === 'sending'}>
                <CloseIcon size={20} />
              </button>
            </header>

            <fieldset className="article-report-categories">
              <legend>O que precisa ser corrigido?</legend>
              <div className="article-report-category-grid">
                {ARTICLE_REPORT_CATEGORIES.map((option) => (
                  <label key={option.value} className={cn('article-report-category', category === option.value && 'is-selected')}>
                    <input
                      type="radio"
                      name="report-category"
                      value={option.value}
                      checked={category === option.value}
                      onChange={() => setCategory(option.value)}
                      disabled={status === 'sending'}
                    />
                    <span aria-hidden="true" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="article-report-description" htmlFor={descriptionId}>
              <span>Conte o que aconteceu</span>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 1200))}
                placeholder="Explique o que está incorreto e, se puder, informe a correção ou a fonte."
                rows={5}
                minLength={10}
                maxLength={1200}
                required
                disabled={status === 'sending'}
              />
              <small>{description.length}/1200</small>
            </label>

            {status === 'error' && (
              <p className="article-report-error" role="alert"><AlertCircle size={16} />{errorMessage}</p>
            )}

            <footer className="article-report-footer">
              <p>Seu reporte fica vinculado a esta matéria.</p>
              <button
                type="submit"
                className="article-report-primary"
                disabled={!category || description.trim().length < 10 || status === 'sending'}
              >
                {status === 'sending' ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
