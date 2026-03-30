'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp } from '@solar-icons/react-perf/Linear'
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

export function ChatThread({
  threadId,
  articleId,
  isEmbedded = true,
  initialMessages = [],
  autoRespond = false,
}: ChatThreadProps) {
  const router = useRouter()

  // State Management
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [currentThreadId, setCurrentThreadId] = useState(threadId)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaHeightRef = useRef<number>(0)
  const autoResponded = useRef(false)

  // Hydration - prevent layout shift
  useEffect(() => {
    setMounted(true)
    // Read sidebar state from localStorage (matches sidebar.tsx)
    const saved = localStorage.getItem('sidebar_collapsed') === 'true'
    setSidebarCollapsed(saved)

    // Listen for storage changes (sidebar collapse/expand in other tabs)
    const handleStorageChange = () => {
      const updated = localStorage.getItem('sidebar_collapsed') === 'true'
      setSidebarCollapsed(updated)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Dynamic padding based on sidebar state (matches sidebar transition: cubic-bezier(0.4, 0, 0.2, 1))
  const paddingLeft = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'

  // Auto-expand textarea on input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInputValue(textarea.value)

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto'

    // Calculate new height (min 2 rows ~40px, max 4 rows ~100px)
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.min(Math.max(scrollHeight, 40), 100)
    textarea.style.height = newHeight + 'px'
    textareaHeightRef.current = newHeight
  }

  // Handle keyboard submission (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }, 0)
    }
  }, [messages])

  // Auto-response logic for full-page mode
  useEffect(() => {
    if (
      isEmbedded === false && // Only in full-page mode
      !isLoading &&
      !autoResponded.current &&
      messages.length > 0
    ) {
      const lastMessage = messages[messages.length - 1]
      const hasAssistantResponse = messages.some((m) => m.role === 'assistant')

      if (lastMessage?.role === 'user' && !hasAssistantResponse) {
        console.log('[ChatThread] Auto-responding to unanswered user message')
        autoResponded.current = true
        handleStreamMessage(lastMessage.content)
      }
    }
  }, [isEmbedded, isLoading, messages.length])

  // Parse NDJSON stream from API
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
        if (line.trim()) {
          try {
            yield JSON.parse(line)
          } catch (e) {
            console.error('[ChatThread] Failed to parse JSON line:', line, e)
          }
        }
      }

      if (done) break
    }
  }

  // Stream message from Gemini API
  const handleStreamMessage = async (messageContent: string) => {
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
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      let fullResponse = ''
      let suggestions: string[] = []

      // Parse streaming response
      for await (const chunk of parseNDJSON(response)) {
        if (chunk.token) {
          fullResponse += chunk.token

          // Update last message in real-time (assistant message)
          setMessages((prev) => {
            const updated = [...prev]
            if (updated[updated.length - 1]?.role === 'assistant') {
              updated[updated.length - 1].content = fullResponse
            } else {
              updated.push({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullResponse,
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

      // Set follow-up suggestions on final message
      setMessages((prev) => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.role === 'assistant') {
          updated[updated.length - 1].followUpSuggestions = suggestions
        }
        return updated
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar resposta'
      setError(errorMessage)
      console.error('[ChatThread] Stream error:', err)
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  // Main send handler
  const handleSend = useCallback(async () => {
    const messageText = inputValue.trim()
    if (!messageText || isSending || isLoading) return

    // Clear input immediately
    setInputValue('')
    if (inputRef.current) {
      inputRef.current.style.height = '40px'
      textareaHeightRef.current = 40
    }

    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])

    // EMBEDDED MODE: Create thread and redirect
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
          throw new Error('Erro ao criar conversa: ID inválido')
        }

        console.log('[ChatThread] Thread created, redirecting to:', newThreadId)

        // Update thread ID first
        setCurrentThreadId(newThreadId)

        // Redirect to thread page (clean URL, no query params)
        router.push(`/threads/${newThreadId}`)
        return
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conversa'
        setError(errorMessage)
        console.error('[ChatThread] Thread creation error:', err)
        setIsSending(false)
        inputRef.current?.focus()
        return
      }
    }

    // FULL-PAGE MODE: Stream response
    setIsSending(true)
    try {
      await handleStreamMessage(messageText)
    } finally {
      setIsSending(false)
    }
  }, [inputValue, isSending, isLoading, isEmbedded, threadId, articleId, router])

  // Handle follow-up suggestion click
  const handleFollowUp = (question: string) => {
    setInputValue(question)
    inputRef.current?.focus()

    // Auto-expand textarea for the suggestion
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto'
        const scrollHeight = inputRef.current.scrollHeight
        const newHeight = Math.min(Math.max(scrollHeight, 40), 100)
        inputRef.current.style.height = newHeight + 'px'
        textareaHeightRef.current = newHeight
      }
    }, 0)
  }

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

  return (
    <div className={`flex flex-col h-full ${mounted ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
      {/* Messages Container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto p-4 space-y-4 pb-[200px] ${paddingLeft} transition-all duration-300`}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-[#F0F0F0] dark:bg-[#2a2a2a] text-black dark:text-white rounded-bl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

                {/* Follow-up Suggestions */}
                {msg.role === 'assistant' && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#ddd] dark:border-[#3a3a3a]">
                    <p className="text-xs font-semibold mb-2 opacity-70">Próximas perguntas:</p>
                    <div className="space-y-1.5">
                      {msg.followUpSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(suggestion)}
                          className="w-full text-left text-xs p-2 rounded bg-[#e8f0ff] dark:bg-[#1a3a5c] text-blue-600 dark:text-blue-300 hover:bg-[#d0e0ff] dark:hover:bg-[#2a4a7c] transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-xs opacity-60 mt-2">{new Date(msg.createdAt).toLocaleTimeString()}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Spinner */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 p-4"
          >
            <div className="w-2 h-2 rounded-full bg-[#ccc] dark:bg-[#555] animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-[#ccc] dark:bg-[#555] animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full bg-[#ccc] dark:bg-[#555] animate-bounce" style={{ animationDelay: '0.2s' }} />
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300"
          >
            ❌ {error}
          </motion.div>
        )}
      </div>

      {/* Fixed Input Area */}
      <div
        className={`fixed bottom-0 left-0 right-0 border-t border-[#E9E9E9] dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] ${paddingLeft} transition-all duration-300`}
      >
        <div className="p-4 relative">
          {/* Loading state feedback for embedded mode */}
          {isSending && isEmbedded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-sm font-medium flex items-center gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4"
              >
                <div className="w-full h-full rounded-full border-2 border-blue-300 dark:border-blue-600 border-t-blue-600 dark:border-t-blue-300" />
              </motion.div>
              Criando conversa...
            </motion.div>
          )}

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta sobre este artigo..."
            rows={1}
            disabled={isSending}
            className="w-full px-4 py-3 pr-12 rounded-xl border border-[#E9E9E9] dark:border-[#2a2a2a] bg-white dark:bg-[#2a2a2a] text-black dark:text-white placeholder-[#999] focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 resize-none disabled:opacity-50 transition-colors"
          />

          <button
            onClick={handleSend}
            disabled={isLoading || isSending || !inputValue.trim()}
            className="absolute bottom-6 right-6 p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-[#333] disabled:text-[#ccc] dark:disabled:text-[#555] transition-colors spring-press"
            aria-label="Enviar mensagem"
          >
            <ArrowUp width={20} height={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

ChatThread.displayName = 'ChatThread'
