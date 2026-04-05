'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Forward2 } from '@solar-icons/react-perf/Linear'
import ReactMarkdown from 'react-markdown'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUpSuggestions?: string[]
  createdAt: string
}

interface ChatThreadProps {
  threadId: string
  articleId: string
  isEmbedded?: boolean
  initialMessages?: ChatMessage[]
  autoRespond?: boolean
}

function stripSuggestionArtifacts(content: string) {
  return content
    .replace(/---\s*LOPHOS_SUGGESTIONS\s*---[\s\S]*$/i, '')
    .replace(/LOPHOS[_\s-]*SUGGESTIONS[\s\S]*$/i, '')
    .replace(/(?:\r?\n)\s*-{3,}\s*$/g, '')
    .trim()
}

function extractSuggestionsFromContent(content: string) {
  const suggestions: string[] = []
  const normalized = content
    .replace(/---\s*LOPHOS_SUGGESTIONS\s*---/i, '\nLOPHOS_SUGGESTIONS\n')
    .split('\n')

  for (const line of normalized) {
    const trimmed = line.trim()
    const questionMatch = trimmed.match(/^\d+\.\s*(.+?)(?:\?)?$/)
    if (!questionMatch || suggestions.length >= 3) continue

    let question = questionMatch[1].trim()
    if (!question.endsWith('?')) {
      question += '?'
    }

    if (question.length > 10) {
      suggestions.push(question)
    }
  }

  return suggestions
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
        console.error('[ChatThread] Failed to parse NDJSON:', err)
      }
    }

    if (done) break
  }
}

function dedupeConsecutiveMessages(messages: ChatMessage[]) {
  return messages.filter((message, index, allMessages) => {
    if (index === 0) return true
    const previous = allMessages[index - 1]
    return !(previous.role === message.role && previous.content.trim() === message.content.trim())
  })
}

const FULLPAGE_COMPOSER_HEIGHT = 88

export function ChatThread({
  threadId,
  articleId,
  isEmbedded = true,
  initialMessages = [],
}: ChatThreadProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [currentThreadId, setCurrentThreadId] = useState(threadId)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoResponded = useRef(false)

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

  useEffect(() => {
    if (!containerRef.current) return
    setTimeout(() => {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }, 0)
  }, [messages])

  useEffect(() => {
    if (isEmbedded || isLoading || autoResponded.current || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user') {
      autoResponded.current = true
      handleStreamMessage(lastMessage.content, true)
    }
  }, [isEmbedded, isLoading, messages])

  const paddingLeft = sidebarCollapsed ? 'md:pl-[3.5rem]' : 'md:pl-[16.1rem]'
  const composerOffset = sidebarCollapsed ? 'md:left-[3.5rem]' : 'md:left-[16.1rem]'

  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, isEmbedded ? 40 : 64), isEmbedded ? 100 : 160)
    textarea.style.height = `${newHeight}px`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    resizeTextarea(e.target)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleStreamMessage = async (messageContent: string, skipUserMessagePersist = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: currentThreadId,
          articleId,
          message: messageContent,
          skipUserMessagePersist,
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      let fullResponse = ''
      let suggestions: string[] = []
      const delimiter = '---LOPHOS_SUGGESTIONS---'

      for await (const chunk of parseNDJSON(response)) {
        if (chunk.token) {
          fullResponse += chunk.token
          const displayContent = stripSuggestionArtifacts(fullResponse.split(delimiter)[0] ?? fullResponse)

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
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar resposta'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSend = useCallback(async (prefilledMessage?: string) => {
    const messageText = (prefilledMessage ?? inputValue).trim()
    if (!messageText || isSending || isLoading) return

    setInputValue('')
    if (inputRef.current) {
      inputRef.current.style.height = isEmbedded ? '40px' : '64px'
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])

    if (isEmbedded && threadId === 'new') {
      setIsSending(true)
      setError(null)

      try {
        const createResponse = await fetch('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId,
            message: messageText,
          }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Erro ao criar conversa')
        }

        const responseData = await createResponse.json()
        const newThreadId = responseData.id
        if (!newThreadId) {
          throw new Error('Erro ao criar conversa')
        }

        setCurrentThreadId(newThreadId)
        router.push(`/threads/${newThreadId}`)
        return
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conversa'
        setError(errorMessage)
        setIsSending(false)
        inputRef.current?.focus()
        return
      }
    }

    setIsSending(true)
    try {
      await handleStreamMessage(messageText)
    } finally {
      setIsSending(false)
    }
  }, [articleId, inputValue, isEmbedded, isLoading, isSending, router, threadId])

  const handleFollowUp = (question: string) => {
    void handleSend(question)
  }

  if (!mounted) {
    return null
  }

  const displayMessages = dedupeConsecutiveMessages(messages)

  return (
    <div className={`${isEmbedded ? 'flex h-full flex-col' : 'block'} transition-opacity duration-300`}>
      <div
        ref={containerRef}
        className={`${isEmbedded ? 'flex-1 overflow-y-auto space-y-4 p-4 pb-[200px]' : 'space-y-8'} ${isEmbedded ? paddingLeft : ''} transition-all duration-300`}
      >
        <AnimatePresence initial={false}>
          {displayMessages.map((msg) => (
            (() => {
              const parsedSuggestions = msg.role === 'assistant' ? extractSuggestionsFromContent(msg.content) : []
              const displayContent = msg.role === 'assistant' ? stripSuggestionArtifacts(msg.content) : msg.content
              const effectiveSuggestions = parsedSuggestions.length > 0 ? parsedSuggestions : (msg.followUpSuggestions || [])

              return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${!isEmbedded && msg.role === 'user' ? 'px-6' : ''}`}
            >
              <div
                className={`${
                  isEmbedded ? 'max-w-[80%]' : msg.role === 'user' ? 'max-w-[70%]' : 'max-w-full'
                } ${
                  msg.role === 'user'
                    ? 'rounded-[1.35rem] rounded-br-md bg-bg-secondary px-6 py-3 text-ink-secondary shadow-sm'
                    : isEmbedded
                      ? 'rounded-2xl rounded-bl-none bg-bg-secondary px-4 py-3 text-ink-primary dark:bg-[#2a2a2a] dark:text-white'
                      : 'px-6 py-6 text-ink-primary dark:text-white'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className={`ai-response-content max-w-none text-body ${isEmbedded ? 'text-sm' : ''}`}>
                    <ReactMarkdown>{displayContent}</ReactMarkdown>
                  </div>
                )}

                {msg.role === 'assistant' && effectiveSuggestions.length > 0 && (
                  <div className={`${isEmbedded ? 'mt-3 pt-3 border-t border-border' : 'mt-6 border-t border-border/70 pt-4'}`}>
                    <div className={isEmbedded ? 'space-y-1.5' : 'flex flex-col items-start gap-2'}>
                      {effectiveSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(suggestion)}
                          className={`${isEmbedded ? 'w-full rounded-lg p-2' : 'inline-flex items-center gap-2 rounded-xl px-3 py-2'} text-left text-sm leading-relaxed text-ink-secondary hover:bg-bg-secondary hover:text-ink-secondary transition-colors`}
                        >
                          {!isEmbedded && <Forward2 size={16} className="flex-shrink-0" />}
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
              )
            })()
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 p-4">
            <div className="h-2 w-2 rounded-full bg-ink-tertiary animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-ink-tertiary animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="h-2 w-2 rounded-full bg-ink-tertiary animate-bounce" style={{ animationDelay: '0.2s' }} />
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-300 bg-red-100/50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {error}
          </motion.div>
        )}
      </div>

      {!isEmbedded && <div className="pointer-events-none" style={{ height: `${FULLPAGE_COMPOSER_HEIGHT}px` }} />}

      <div className={`fixed bottom-0 left-0 right-0 ${composerOffset} z-30 pointer-events-none transition-all duration-300`}>
        {!isEmbedded && (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-bg-primary" />
        )}

        <div className={isEmbedded ? 'pointer-events-auto relative mx-auto article-layout p-4 md:p-6' : 'pointer-events-auto relative mx-auto article-layout px-0 pb-5 pt-1'}>
          {isSending && isEmbedded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4"
              >
                <div className="h-full w-full rounded-full border-2 border-accent/30 border-t-accent" />
              </motion.div>
              Criando conversa...
            </motion.div>
          )}

          {isEmbedded ? (
            <>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte qualquer coisa"
                rows={1}
                disabled={isSending}
                className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 pr-12 text-black placeholder-ink-muted transition-colors focus:border-accent focus:outline-none disabled:opacity-50 dark:bg-[#2a2a2a] dark:text-white dark:focus:border-accent"
              />

              <button
                onClick={() => void handleSend()}
                disabled={isLoading || isSending || !inputValue.trim()}
                className="absolute right-4 top-6 rounded-lg bg-[var(--color-ui-strong)] p-2 text-white transition-colors spring-press disabled:opacity-40 md:right-6"
                aria-label="Enviar mensagem"
              >
                <ArrowUp width={20} height={20} />
              </button>
            </>
          ) : (
            <div className="flex min-h-16 items-center gap-3 rounded-[1.5rem] border border-border bg-white px-3 py-2 shadow-[0_18px_40px_rgba(20,20,20,0.08)]">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte qualquer coisa"
                rows={1}
                disabled={isSending}
                className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-black placeholder-ink-muted transition-colors focus:outline-none disabled:opacity-50 dark:text-white"
              />

              <button
                onClick={() => void handleSend()}
                disabled={isLoading || isSending || !inputValue.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-strong)] text-white transition-colors spring-press disabled:opacity-40"
                aria-label="Enviar mensagem"
              >
                <ArrowUp width={20} height={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

ChatThread.displayName = 'ChatThread'
