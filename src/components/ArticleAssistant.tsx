'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp } from '@solar-icons/react-perf/Linear'

interface ArticleAssistantProps {
  articleId: string
}

export function ArticleAssistant({ articleId }: ArticleAssistantProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar_collapsed') === 'true'
    setSidebarCollapsed(saved)

    const handleStorageChange = () => {
      setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true')
    }

    const handleSidebarToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed?: boolean }>
      if (typeof customEvent.detail?.collapsed === 'boolean') {
        setSidebarCollapsed(customEvent.detail.collapsed)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('sidebar:toggle', handleSidebarToggle)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('sidebar:toggle', handleSidebarToggle)
    }
  }, [])

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
      const resolvedThreadId = data.id

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

  if (!mounted) {
    return null
  }

  const composerOffset = sidebarCollapsed ? 'md:left-[3.5rem]' : 'md:left-[16.1rem]'

  return (
    <>
      <div aria-hidden="true" className="mt-10" style={{ height: '88px' }} />

      <div className={`fixed bottom-0 left-0 right-0 ${composerOffset} z-30 pointer-events-none transition-all duration-300`}>
        <div className="absolute inset-x-0 bottom-0 h-8 bg-bg-primary" />

        <div className="pointer-events-auto relative mx-auto article-layout px-0 pb-5 pt-1">
          <div className="flex min-h-16 items-center gap-3 rounded-[1.5rem] border border-border bg-white px-3 py-2 shadow-[0_18px_40px_rgba(20,20,20,0.08)]">
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
              className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-black placeholder-ink-muted transition-colors focus:outline-none disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={isSending || !inputValue.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-strong)] text-white shadow-sm transition-opacity disabled:opacity-40"
              aria-label="Enviar pergunta"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </>
  )
}
