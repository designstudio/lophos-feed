'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, SquareTopDown } from '@solar-icons/react-perf/Linear'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUpSuggestions?: string[]
  createdAt: string
}

interface ThreadLookupResponse {
  thread: null | {
    id: string
    title: string
    article_id: string
  }
  messages: ChatMessage[]
}

interface ArticleAssistantProps {
  articleId: string
  articleTitle: string
}

async function* parseNDJSON(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        yield JSON.parse(line)
      } catch (err) {
        console.error('[ArticleAssistant] Failed to parse NDJSON chunk:', err)
      }
    }

    if (done) break
  }
}

export function ArticleAssistant({ articleId, articleTitle }: ArticleAssistantProps) {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isBooting, setIsBooting] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      try {
        const response = await fetch(`/api/chat/threads?articleId=${encodeURIComponent(articleId)}`)
        if (!response.ok) {
          throw new Error('Nao foi possivel carregar o historico')
        }

        const data = (await response.json()) as ThreadLookupResponse
        if (cancelled) return

        if (data.thread) {
          setThreadId(data.thread.id)
          setMessages(data.messages || [])
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Erro ao carregar conversa'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false)
        }
      }
    }

    loadThread()

    return () => {
      cancelled = true
    }
  }, [articleId])

  useEffect(() => {
    if (!messagesRef.current) return
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 56), 160)}px`
  }

  const ensureThread = async (message: string) => {
    if (threadId) return threadId

    const response = await fetch('/api/chat/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId,
        message,
        saveMessage: false,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Nao foi possivel criar a conversa')
    }

    const data = await response.json()
    if (!data.id) {
      throw new Error('Thread invalida')
    }

    setThreadId(data.id)
    return data.id as string
  }

  const handleSend = async (seedQuestion?: string) => {
    const messageText = (seedQuestion ?? inputValue).trim()
    if (!messageText || isSending) return

    setError(null)
    setIsSending(true)
    setInputValue('')

    if (inputRef.current) {
      inputRef.current.style.height = '56px'
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const resolvedThreadId = await ensureThread(messageText)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: resolvedThreadId,
          articleId,
          message: messageText,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Erro na API (${response.status})`)
      }

      let fullResponse = ''
      let suggestions: string[] = []
      const delimiter = '---LOPHOS_SUGGESTIONS---'

      for await (const chunk of parseNDJSON(response)) {
        if (chunk.token) {
          fullResponse += chunk.token
          const displayContent = fullResponse.split(delimiter)[0].trim()

          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]

            if (last?.role === 'assistant') {
              last.content = displayContent
            } else {
              updated.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: displayContent,
                createdAt: new Date().toISOString(),
              })
            }

            return updated
          })
        }

        if (chunk.complete && chunk.suggestions) {
          suggestions = chunk.suggestions
        }

        if (chunk.error) {
          throw new Error(chunk.error)
        }
      }

      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') {
          last.followUpSuggestions = suggestions
        }
        return updated
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar mensagem'
      setError(message)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <section className="mt-10 mb-8 rounded-[1.5rem] border border-border bg-bg-primary shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
            AI Chat
          </p>
          <h2 className="text-[1.05rem] font-semibold text-ink-primary mt-1">
            Converse sobre este artigo
          </h2>
          <p className="text-sm text-ink-secondary mt-1">
            Pergunte sobre contexto, impacto, personagens, mercado ou qualquer detalhe de{' '}
            <span className="text-ink-primary font-medium">{articleTitle}</span>.
          </p>
        </div>

        {threadId && (
          <Link
            href={`/threads/${threadId}`}
            className="spring-press inline-flex items-center gap-1.5 px-3 py-2 rounded-[1rem] border border-border text-[13px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-all whitespace-nowrap"
          >
            <SquareTopDown size={14} />
            Abrir conversa
          </Link>
        )}
      </div>

      <div ref={messagesRef} className="max-h-[34rem] overflow-y-auto px-5 py-5 space-y-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.6),rgba(255,255,255,0))]">
        {isBooting && (
          <div className="space-y-3">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        )}

        {!isBooting && messages.length === 0 && (
          <div className="rounded-[1.25rem] border border-dashed border-border bg-bg-secondary/60 px-4 py-4">
            <p className="text-sm text-ink-secondary leading-relaxed">
              Exemplos: “Sobre o que e esse filme?”, “Qual o impacto disso no Brasil?” ou “Me explica o contexto antes dessa noticia”.
            </p>
          </div>
        )}

        {!isBooting && messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-[1.25rem] px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-[var(--color-ui-strong)] text-white rounded-br-md'
                  : 'bg-bg-secondary text-ink-primary rounded-bl-md'
              }`}
            >
              {message.role === 'user' ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none text-sm leading-relaxed text-ink-primary">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}

              {message.role === 'assistant' && message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
                    Proximas perguntas
                  </p>
                  {message.followUpSuggestions.map((suggestion, index) => (
                    <button
                      key={`${message.id}-${index}`}
                      onClick={() => handleSend(suggestion)}
                      disabled={isSending}
                      className="block w-full text-left rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary hover:border-border-strong transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-[1.25rem] rounded-bl-md bg-bg-secondary px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-ink-tertiary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-ink-tertiary animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 rounded-full bg-ink-tertiary animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 bg-bg-primary">
        <div className="relative">
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
            placeholder="Pergunte um seguimento sobre este artigo"
            className="w-full min-h-14 resize-none rounded-[1.25rem] border border-border bg-white px-4 py-4 pr-14 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
          />

          <button
            onClick={() => handleSend()}
            disabled={isSending || !inputValue.trim()}
            className="absolute right-3 bottom-3 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-ui-strong)] text-white disabled:opacity-40 transition-opacity"
            aria-label="Enviar pergunta"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
