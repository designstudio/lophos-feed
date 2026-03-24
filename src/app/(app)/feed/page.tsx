'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { LophosLogo } from '@/components/LophosLogo'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { Feed } from '@solar-icons/react-perf/Linear'
import Lottie from 'lottie-react'
import blogAnimation from '@/lib/animations/blog.json'
import { NewsItem } from '@/lib/types'
import { useFeedContext } from '@/components/FeedContext'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'
import FloatSidebar from 'float-sidebar'

const toTitleCase = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function FeedBlock({ items, blockIndex }: { items: NewsItem[]; blockIndex: number }) {
  const posInCycle = blockIndex % 3

  // Full block (positions 0 and 2 in cycle)
  if (posInCycle !== 1) {
    const variant = posInCycle === 2 ? 'full-right' : 'full-left'
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant={variant} />
      </div>
    )
  }

  // Trio slot — 1, 2 or 3 cards
  if (items.length === 1) {
    // Not enough for grid, show as full-left
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant="full-left" />
      </div>
    )
  }

  return (
    <div className="md:py-6 md:border-b md:border-border">
      <div className={cn('grid gap-0 md:gap-6', items.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3')}>
        {items.map(item => <NewsCard key={item.id} item={item} variant="card" />)}
      </div>
    </div>
  )
}

function splitIntoBlocks(items: NewsItem[]): { items: NewsItem[]; isFull: boolean }[] {
  const blocks: { items: NewsItem[]; isFull: boolean }[] = []
  let i = 0
  // Strict cycle: full, trio(1-3 cards), full, full, trio, full...
  // Position in cycle: 0=full, 1=trio, 2=full → repeat
  while (i < items.length) {
    const pos = blocks.length % 3

    if (pos === 1) {
      // Trio slot — take up to 3, minimum 1
      const count = Math.min(3, items.length - i)
      blocks.push({ items: items.slice(i, i + count), isFull: false })
      i += count
    } else {
      // Full slot
      blocks.push({ items: [items[i]], isFull: true })
      i++
    }
  }
  return blocks
}

function TopicsDropdown({ topics, activeFilter, onSelect }: {
  topics: string[]
  activeFilter: string | null
  onSelect: (t: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[0.875rem] px-4 h-14 border-b-2 transition-all font-medium',
          activeFilter
            ? 'border-ink-primary text-ink-primary'
            : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
        )}
      >
        {activeFilter ?? 'Tópicos'}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={cn('transition-transform flex-shrink-0', open ? 'rotate-180' : '')}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1.5"
          style={{ animation: 'slideUp 0.12s ease' }}>
          {activeFilter && (
            <button
              onClick={() => { onSelect(null); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-ink-tertiary hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Ver todos
            </button>
          )}
          {topics.map(t => (
            <button key={t}
              onClick={() => { onSelect(t); setOpen(false) }}
              className={cn(
                'flex items-center w-full px-4 py-2.5 text-sm transition-colors text-left',
                activeFilter === t
                  ? 'text-ink-primary font-medium bg-gray-50'
                  : 'text-ink-secondary hover:bg-gray-50'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FeedPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { setRefreshing, onRefreshCallback, updatesReady, setUpdatesReady, onApplyUpdatesCallback } = useFeedContext()
  const [items, setItems]         = useState<NewsItem[]>([])
  const [topics, setTopics]       = useState<string[]>([])
  const [streaming, setStreamingLocal] = useState(false)
  const setStreaming = (v: boolean) => { setStreamingLocal(v); setRefreshing(v) }
  const [hasData, setHasData]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<NewsItem[]>([])
  const [coldStartLoading, setColdStartLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const feedRowRef   = useRef<HTMLDivElement>(null)
  const sidebarRef   = useRef<HTMLDivElement>(null)
  const initialCacheAppliedRef = useRef(false)
  const pendingRef = useRef<NewsItem[]>([])
  const coldStartRef = useRef(false)

  const coldStartMessages = [
    'O Lophos está preparando o seu feed!',
    'Pode levar alguns minutos para você começar a ver os resultados.',
  ]

  const setPending = (next: NewsItem[] | ((prev: NewsItem[]) => NewsItem[])) => {
    setPendingItems(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      pendingRef.current = resolved
      return resolved
    })
  }

  const applyPendingUpdates = useCallback(() => {
    if (pendingItems.length === 0) return
    setItems(prev => {
      const byId = new Map(prev.map(x => [x.id, x]))
      for (const x of pendingItems) {
        const existing = byId.get(x.id)
        if (!existing || (!existing.imageUrl && x.imageUrl)) {
          byId.set(x.id, x)
        }
      }
      const merged = Array.from(byId.values())
      merged.sort((a, b) =>
        new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
        new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
      )
      return merged
    })
    setPending([])
    setUpdatesReady(false)
  }, [pendingItems, setUpdatesReady, setPending, setItems])

  useEffect(() => {
    onApplyUpdatesCallback.current = () => applyPendingUpdates()
  }, [onApplyUpdatesCallback, applyPendingUpdates])

  const setColdStart = (v: boolean) => {
    coldStartRef.current = v
    setColdStartLoading(v)
  }

  const fetchFeed = useCallback(async (force = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStreaming(true)
    setError(null)
    setUpdatesReady(false)
    setPending([])
    setColdStart(false)
    initialCacheAppliedRef.current = false
    if (force) { setItems([]); setHasData(false) }

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: [], forceRefresh: force }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        let msg = 'Erro ao carregar feed.'
        try {
          const data = await res.json()
          if (typeof data?.error === 'string') msg = data.error
        } catch {}
        setError(msg)
        return
      }
      if (!res.body) return
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line)
            if (chunk.topics) { setTopics(chunk.topics); continue }
            if (chunk.coldStart) {
              setError(null)
              setColdStart(true)
              continue
            }
            if (chunk.refreshComplete) {
              if (coldStartRef.current) {
                if (pendingRef.current.length > 0) {
                  setItems(pendingRef.current)
                  setHasData(true)
                }
                setPending([])
                setColdStart(false)
              } else if (pendingRef.current.length > 0) {
                setUpdatesReady(true)
              }
              continue
            }
            if (chunk.items?.length) {
              if (!initialCacheAppliedRef.current && !coldStartLoading) {
                setItems(prev => {
                  const byId = new Map(prev.map(x => [x.id, x]))
                  for (const x of chunk.items as NewsItem[]) {
                    const existing = byId.get(x.id)
                    if (!existing || (!existing.imageUrl && x.imageUrl)) {
                      byId.set(x.id, x)
                    }
                  }
                  const merged = Array.from(byId.values())
                  merged.sort((a, b) =>
                    new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
                    new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
                  )
                  return merged
                })
                setHasData(true)
                setError(null)
                initialCacheAppliedRef.current = true
              } else {
                setPending(prev => {
                  const byId = new Map(prev.map(x => [x.id, x]))
                  for (const x of chunk.items as NewsItem[]) {
                    const existing = byId.get(x.id)
                    if (!existing || (!existing.imageUrl && x.imageUrl)) {
                      byId.set(x.id, x)
                    }
                  }
                  const merged = Array.from(byId.values())
                  merged.sort((a, b) =>
                    new Date(b.cachedAt ?? b.publishedAt ?? 0).getTime() -
                    new Date(a.cachedAt ?? a.publishedAt ?? 0).getTime()
                  )
                  return merged
                })
              }
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      setStreaming(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Register fetchFeed with the shared layout so Sidebar can trigger it
  useEffect(() => {
    onRefreshCallback.current = () => fetchFeed(true)
  }, [fetchFeed])

  useEffect(() => { if (isLoaded && isSignedIn) fetchFeed() }, [isLoaded, isSignedIn])

  // FloatSidebar — sticky right sidebar with smart scroll
  useEffect(() => {
    if (!sidebarRef.current || !feedRowRef.current || !scrollRef.current) return
    const instance = FloatSidebar({
      sidebar:   sidebarRef.current,
      relative:  feedRowRef.current,
      viewport:  scrollRef.current,
      topSpacing: 24,
      bottomSpacing: 24,
    })
    return () => instance.destroy()
  }, [])

  // Poll for new articles every 5 minutes
  useEffect(() => {
    const POLL_INTERVAL = 6 * 60 * 60 * 1000
    const interval = setInterval(async () => {
      if (items.length === 0 || topics.length === 0) return
      const newest = items.reduce((max, i) =>
        new Date(i.cachedAt ?? i.publishedAt ?? 0) > new Date(max.cachedAt ?? max.publishedAt ?? 0) ? i : max
      )
      const since = newest.cachedAt ?? newest.publishedAt
      if (!since) return
      try {
        const res = await fetch('/api/feed/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ since, topics }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.hasUpdates && data.items?.length > 0) {
          const newItems: NewsItem[] = data.items.map((row: any) => ({
            id: row.id, topic: row.topic, title: row.title, summary: row.summary,
            sections: row.sections || [], conclusion: row.conclusion || undefined,
            sources: row.sources, imageUrl: row.image_url,
            publishedAt: row.published_at, cachedAt: row.cached_at,
            displayTopic: topics.find((t: string) => (row.matched_topics ?? []).includes(t)) ?? row.topic,
          }))
          setPending(newItems)
          setUpdatesReady(true)
        }
      } catch {}
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [items, topics, setUpdatesReady])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisibleBlocks(v => v + 4) },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasData])

  const filteredItems = activeFilter ? items.filter(i => toTitleCase(i.displayTopic ?? i.topic) === activeFilter) : items
  const topicsInFeed  = [...new Set(items.map(i => toTitleCase(i.displayTopic ?? i.topic)))]
  const allBlocks     = splitIntoBlocks(filteredItems)
  const shownBlocks   = allBlocks.slice(0, visibleBlocks)
  const hasMore       = visibleBlocks < allBlocks.length
  const showSkeleton  = !hasData && streaming
  const showEmpty     = !hasData && !streaming && !coldStartLoading
  const emptyMessage  = error
    ? (error.toLowerCase().includes('no topics')
        ? 'Nenhum tópico salvo. Selecione seus tópicos no onboarding ou em Configurações.'
        : error)
    : 'Nenhuma notícia encontrada.'


  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto min-w-0">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 border-b border-border header-blur">

          {/* Mobile: title (always visible) */}
          <div className="flex items-center h-12 px-4 md:hidden gap-2">
            <LophosLogo size={26} />
            <h1 className="text-[15px] font-semibold text-ink-primary">Meu Feed</h1>
          </div>

          {/* Mobile: horizontal scrollable tabs (only if has data) */}
          {hasData && topicsInFeed.length > 0 && (
            <div className="flex md:hidden overflow-x-auto no-scrollbar gap-2 px-4 pb-3"
              style={{ WebkitOverflowScrolling: 'touch' }}>
              {(['Últimas notícias', ...topicsInFeed] as (string | null)[]).map((t, i) => {
                const val = i === 0 ? null : t as string
                const active = activeFilter === val
                return (
                  <button
                    key={t ?? 'top'}
                    onClick={() => { setActiveFilter(val); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className={cn(
                      'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border',
                      active
                        ? 'bg-ink-primary text-bg-primary border-ink-primary'
                        : 'border-border text-ink-tertiary hover:text-ink-secondary'
                    )}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          )}

          {/* Desktop: title + dropdown tabs (only if has data) */}
          {hasData && topicsInFeed.length > 0 && (
            <div className="hidden md:flex items-center h-14 px-8">
              <h1 className="text-[15px] font-semibold text-ink-primary flex-shrink-0" style={{ width: '12rem' }}>Meu Feed</h1>
              <div className="flex flex-1 justify-center">
                <button
                  onClick={() => { setActiveFilter(null); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className={cn(
                    'text-[0.875rem] px-4 h-14 border-b-2 transition-all font-medium',
                    activeFilter === null
                      ? 'border-ink-primary text-ink-primary'
                      : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
                  )}
                >
                  Últimas notícias
                </button>
                <TopicsDropdown
                  topics={topicsInFeed}
                  activeFilter={activeFilter}
                  onSelect={(t) => { setActiveFilter(t); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                />
              </div>
              <div style={{ width: '12rem' }} />
            </div>
          )}

          {/* Desktop: title only (when no data) */}
          {(!hasData || topicsInFeed.length === 0) && (
            <div className="hidden md:flex items-center h-14 px-8">
              <h1 className="text-[15px] font-semibold text-ink-primary">Meu Feed</h1>
            </div>
          )}
        </div>

        {/* ── Feed + Right sidebar ── */}
        <div className="feed-layout mx-auto px-4 md:px-8">
          <div ref={feedRowRef} className="flex gap-10 pt-0 pb-24 md:py-6 md:pb-6">
            <div className="flex-1 min-w-0">

              {coldStartLoading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-24 h-24 mb-6">
                    <Lottie animationData={blogAnimation} loop autoplay />
                  </div>
                  <div className="max-w-md">
                    {coldStartMessages.map((msg, i) => (
                      <p key={i} className="text-ink-secondary text-sm mb-1">
                        {msg}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {showSkeleton && !coldStartLoading && (
                <><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></>
              )}

              {hasData && streaming && (
                <div className="flex items-center gap-2 text-xs text-ink-tertiary mb-4 px-1">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                  </svg>
                  Buscando novidades…
                </div>
              )}

              {updatesReady && (
                <div className="mb-4 px-1">
                  <button
                    onClick={applyPendingUpdates}
                    className="text-sm text-white bg-ink-primary hover:bg-ink-secondary px-3 py-2 rounded-full transition-colors"
                  >
                    Seu feed tem novas notícias — ver agora
                  </button>
                </div>
              )}

              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <Feed size={32} className="text-ink-muted mb-4" />
                  <p className="text-ink-secondary">{emptyMessage}</p>
                  <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

              {shownBlocks.map((block, i) => (
                <FeedBlock key={i} items={block.items} blockIndex={i} />
              ))}

              {hasData && (
                <div ref={sentinelRef}>
                  {hasMore && <SkeletonBlock />}
                </div>
              )}
            </div>

            <div ref={sidebarRef} className="sidebar-right hidden lg:block">
              <RightSidebar topics={topics} />
            </div>
          </div>
        </div>
      </div>
  )
}

