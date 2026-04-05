'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp } from '@solar-icons/react-perf/Linear'

interface ThreadLookupResponse {
  thread?: {
    id: string
    title: string
    article_id: string
  } | null
}

interface ArticleAssistantProps {
  articleId: string
}

export function ArticleAssistant({ articleId }: ArticleAssistantProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      try {
        const response = await fetch(`/api/chat/threads?articleId=${encodeURIComponent(articleId)}`)
        if (!response.ok) return

        const data = (await response.json()) as ThreadLookupResponse
        if (!cancelled && data.thread?.id) {
          setThreadId(data.thread.id)
        }
      } catch {
      }
    }

    loadThread()
    return () => {
      cancelled = true
    }
  }, [articleId])

  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 64), 140)}px`
  }

  const handleSend = async () => {
    const message = inputValue.trim()
    if (!message || isSending) return

    setError(null)
    setIsSending(true)

    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          message,
          saveMessage: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Nao foi possivel abrir a conversa')
      }

      const data = await response.json()
      const resolvedThreadId = data.id || threadId

      if (!resolvedThreadId) {
        throw new Error('Thread invalida')
      }

      router.push(`/threads/${resolvedThreadId}`)
    } catch (err) {
      setIsSending(false)
      setError(err instanceof Error ? err.message : 'Erro ao abrir a conversa')
      return
    }
  }

  return (
    <section className="mt-10 mb-8">
      <div className="rounded-[1.5rem] border border-border bg-white/92 shadow-[0_20px_60px_rgba(20,20,20,0.06)] backdrop-blur-sm">
        <div className="px-5 pt-4 pb-2">
          <p className="text-sm text-ink-muted">
            {threadId ? 'Continue a conversa sobre este artigo' : 'Pergunte qualquer coisa sobre este artigo'}
          </p>
        </div>

        <div className="px-4 pb-4">
          <div className="relative rounded-[1.35rem] border border-border bg-bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value)
                resizeTextarea(event.target)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              disabled={isSending}
              placeholder="Pergunte qualquer coisa"
              className="w-full min-h-16 resize-none rounded-[1.35rem] bg-transparent px-4 py-4 pr-16 text-[15px] text-ink-primary placeholder:text-ink-muted focus:outline-none disabled:opacity-60"
            />

            <button
              onClick={handleSend}
              disabled={isSending || !inputValue.trim()}
              className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-ui-strong)] text-white shadow-sm transition-opacity disabled:opacity-40"
              aria-label="Enviar pergunta"
            >
              <ArrowUp size={18} />
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
    </section>
  )
}
