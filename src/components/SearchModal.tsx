'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { NewsItem } from '@/lib/types'
import { Clock as ClockCircle, X as CloseCircle } from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useModalTransition } from '@/hooks/useModalTransition'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  userTopics?: string[]
}

export function SearchModal({ isOpen, onClose, userTopics = [] }: SearchModalProps) {
  const modalTransition = useModalTransition(isOpen)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const topicsWereReadyRef = useRef(userTopics.length > 0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (modalTransition.open) inputRef.current?.focus()
  }, [modalTransition.open])

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('search_history')
    if (saved) {
      setHistory(JSON.parse(saved))
    }
  }, [])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    // Guarda: sem tópicos carregados, não expõe o banco inteiro
    if (userTopics.length === 0) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20',
        topics: userTopics.join(','),
      })
      const res = await fetch(`/api/articles/search?${params}`)
      const data = await res.json()
      setResults(data.items || [])
    } catch (err) {
      console.error('Search error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [userTopics])

  // If the user types while their topics are still loading, run that pending
  // search as soon as the scoped topic list becomes available.
  useEffect(() => {
    const topicsAreReady = userTopics.length > 0
    if (topicsAreReady && !topicsWereReadyRef.current && query.trim()) {
      void performSearch(query)
    }
    topicsWereReadyRef.current = topicsAreReady
  }, [performSearch, query, userTopics.length])

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)

    // Clear previous debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounce
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  const handleHistoryClick = (item: string) => {
    setQuery(item)
    performSearch(item)
  }

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return

    // Add to history
    const newHistory = [searchQuery, ...history.filter(h => h !== searchQuery)].slice(0, 10)
    setHistory(newHistory)
    localStorage.setItem('search_history', JSON.stringify(newHistory))
  }

  const handleClearHistory = () => {
    setHistory([])
    localStorage.removeItem('search_history')
  }

  const handleResultClick = (searchQuery: string) => {
    handleSearch(searchQuery)
  }

  if (!modalTransition.rendered) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-0"
      style={{ backgroundColor: "#05050533", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className={cn(
          't-modal relative w-full max-w-2xl max-h-[80vh] bg-white rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden',
          modalTransition.open && 'is-open',
          modalTransition.closing && 'is-closing',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar notícias"
        aria-hidden={!modalTransition.open}
        inert={!modalTransition.open}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                handleSearch(query)
              }
            }}
            placeholder="Buscar notícias..."
            className="flex-1 outline-none text-ink-primary placeholder-ink-tertiary bg-transparent p-2"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 text-ink-tertiary hover:text-ink-primary transition-colors p-1"
            aria-label="Fechar busca"
          >
            <CloseCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {query.trim().length === 0 ? (
            // History
            <div className="p-6">
              {history.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-ink-primary">Buscas recentes</h3>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {history.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleHistoryClick(item)}
                        className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-bg-secondary transition-colors text-left"
                      >
                        <ClockCircle size={16} className="text-ink-tertiary flex-shrink-0" />
                        <span className="text-sm text-ink-primary">{item}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {history.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-ink-tertiary text-sm">Nenhuma busca anterior</p>
                </div>
              )}
            </div>
          ) : loading ? (
            // Loading state
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="h-4 bg-bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-bg-secondary rounded w-full" />
                  <div className="h-3 bg-bg-secondary rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            // Results
            <div className="p-4 space-y-4">
              {results.map((item) => (
                <Link
                  key={item.id}
                  href={`/article/${item.id}`}
                  prefetch={false}
                  onClick={() => {
                    handleResultClick(query)
                    onClose()
                  }}
                  className="block"
                >
                  <div className="p-3 rounded-lg border border-border hover:border-border-strong hover:bg-bg-secondary transition-all cursor-pointer">
                    <h3 className="font-semibold text-ink-primary text-sm line-clamp-2 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-ink-secondary line-clamp-2">
                      {item.summary}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            // Empty state
            <div className="p-6 text-center">
              <p className="text-ink-tertiary text-sm">Nenhuma notícia encontrada</p>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  )
}
