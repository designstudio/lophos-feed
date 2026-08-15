'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { NewsCard } from '@/components/NewsCard'
import { LophosLogo } from '@/components/LophosLogo'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { IconFeed as Feed } from '@/components/icons'
import { Settings04 as Tuning2 } from '@untitledui/icons'
import { FeedItem } from '@/lib/types'
import { useFeedContext } from '@/components/FeedContext'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'
import { FEED_CACHE_MAX_ITEMS, FEED_CACHE_VERSION } from '@/lib/feed-pagination-config'

const toTitleCase = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const FeedColdStartAnimation = dynamic(
  () => import('@/components/FeedColdStartAnimation'),
  { ssr: false },
)

const FEED_CACHE_KEY = 'lophos_feed_cache'
const FEED_CACHE_TTL = 5 * 60 * 1000

type FeedCache = {
  version: typeof FEED_CACHE_VERSION
  items: FeedItem[]
  timestamp: number
  days: number
  nextCursor: string | null
  hasMore: boolean
  topics: string[]
  activeFilter: string | null
}

function readFeedCache(expectedDays: number): FeedCache | null {
  const serialized = sessionStorage.getItem(FEED_CACHE_KEY)
  if (!serialized) return null

  try {
    const cache = JSON.parse(serialized) as Partial<FeedCache>
    const isCurrent = cache.version === FEED_CACHE_VERSION
      && typeof cache.timestamp === 'number'
      && Date.now() - cache.timestamp < FEED_CACHE_TTL
      && cache.days === expectedDays
      && Array.isArray(cache.items)
      && cache.items.length > 0
      && cache.items.length <= FEED_CACHE_MAX_ITEMS
      && (typeof cache.nextCursor === 'string' || cache.nextCursor === null)
      && typeof cache.hasMore === 'boolean'
      && Array.isArray(cache.topics)
      && cache.topics.every((topic) => typeof topic === 'string')
      && (typeof cache.activeFilter === 'string' || cache.activeFilter === null)

    if (isCurrent) return cache as FeedCache
  } catch {}

  sessionStorage.removeItem(FEED_CACHE_KEY)
  return null
}

function writeFeedCache(cache: Omit<FeedCache, 'version' | 'timestamp'>) {
  // Keep unlimited navigation in memory, but retain only the first four pages as
  // a coherent restorable checkpoint. Once the session passes that point, the
  // existing checkpoint remains valid instead of pairing truncated items with a
  // cursor from a much later page.
  if (cache.items.length === 0 || cache.items.length > FEED_CACHE_MAX_ITEMS) return

  try {
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      ...cache,
      version: FEED_CACHE_VERSION,
      timestamp: Date.now(),
    } satisfies FeedCache))
  } catch {}
}

function mergeFeedItems(current: FeedItem[], incoming: FeedItem[], prepend = false) {
  const ordered = prepend ? [...incoming, ...current] : [...current, ...incoming]
  const byId = new Map<string, FeedItem>()

  for (const item of ordered) {
    const existing = byId.get(item.id)
    if (!existing) {
      byId.set(item.id, item)
    } else if (!existing.imageUrl && item.imageUrl) {
      byId.set(item.id, { ...existing, ...item })
    }
  }

  return Array.from(byId.values())
}

type FeedPageResponse = {
  items: FeedItem[]
  topics: string[]
  nextCursor: string | null
  hasMore: boolean
  coldStart: boolean
}

async function requestFeedPage({
  days,
  cursor,
  force,
  signal,
}: {
  days: number
  cursor?: string | null
  force?: boolean
  signal: AbortSignal
}): Promise<FeedPageResponse> {
  const response = await fetch('/api/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topics: [],
      forceRefresh: Boolean(force),
      days,
      ...(cursor ? { cursor } : {}),
    }),
    signal,
  })

  if (!response.ok) {
    let message = 'Erro ao carregar feed.'
    try {
      const data = await response.json()
      if (typeof data?.error === 'string') message = data.error
    } catch {}
    throw new Error(message)
  }
  if (!response.body) throw new Error('Resposta vazia ao carregar feed.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const result: FeedPageResponse = {
    items: [],
    topics: [],
    nextCursor: null,
    hasMore: false,
    coldStart: false,
  }
  let buffer = ''

  const consumeLine = (line: string) => {
    if (!line.trim()) return
    const chunk = JSON.parse(line)
    if (chunk.error) throw new Error(typeof chunk.error === 'string' ? chunk.error : 'Erro ao carregar feed.')
    if (Array.isArray(chunk.topics)) result.topics = chunk.topics
    if (Array.isArray(chunk.items)) result.items.push(...chunk.items)
    if (chunk.coldStart) result.coldStart = true
    if (typeof chunk.hasMore === 'boolean') result.hasMore = chunk.hasMore
    if (typeof chunk.nextCursor === 'string' || chunk.nextCursor === null) {
      result.nextCursor = chunk.nextCursor
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) consumeLine(line)
  }
  buffer += decoder.decode()
  if (buffer.trim()) consumeLine(buffer)

  return result
}

function FeedBlock({ items, blockIndex, reactions, fadingOut, onReactionChange }: {
  items: FeedItem[]
  blockIndex: number
  reactions: Record<string, 'like' | 'dislike'>
  fadingOut: Set<string>
  onReactionChange: (id: string, r: 'like' | 'dislike' | null) => void
}) {
  return (
    <div className="editorial-card-stack" data-feed-block={blockIndex}>
      {items.map((item) => (
        <NewsCard
          key={item.id}
          item={item}
          initialReaction={reactions[item.id] ?? null}
          fadingOut={fadingOut.has(item.id)}
          onReactionChange={onReactionChange}
        />
      ))}
    </div>
  )
}

function splitIntoBlocks(items: FeedItem[]): { items: FeedItem[]; isFull: boolean }[] {
  return items.map((item) => ({ items: [item], isFull: true }))
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
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'editorial-filter flex items-center gap-1.5 transition-colors',
          activeFilter
            ? 'is-active'
            : 'text-ink-tertiary hover:text-ink-primary'
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
              type="button"
              onClick={() => { onSelect(null); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-ink-tertiary hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Ver todos
            </button>
          )}
          {topics.map(t => (
            <button key={t}
              type="button"
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

const TIME_OPTIONS: { label: string; days: number }[] = [
  { label: 'Últimas 24h', days: 1 },
  { label: 'Últimas 48h', days: 2 },
  { label: 'Última semana', days: 7 },
  { label: 'Último mês', days: 30 },
  { label: 'Sem limite', days: 0 },
]

function TimeFilterDropdown({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = TIME_OPTIONS.find(o => o.days === days) ?? TIME_OPTIONS[1]
  const isDefault = days === 2

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'editorial-filter flex items-center gap-1.5 transition-colors spring-press',
          !isDefault
            ? 'is-active'
            : 'text-ink-tertiary hover:text-ink-primary'
        )}
      >
        <Tuning2 size={15} />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-1.5 min-w-[11rem] rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]"
          style={{ animation: 'slideUp 0.12s ease' }}>
          {TIME_OPTIONS.map(o => (
            <button
              key={o.days}
              type="button"
              onClick={() => { onChange(o.days); setOpen(false) }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                days === o.days
                  ? 'bg-bg-secondary font-medium text-ink-primary'
                  : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary'
              )}
            >
              {o.label}
              {days === o.days && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
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
  const [items, setItems]         = useState<FeedItem[]>([])
  const [topics, setTopics]       = useState<string[]>([])
  const [streaming, setStreamingLocal] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const setStreaming = (v: boolean) => { setStreamingLocal(v); setRefreshing(v) }
  const [hasData, setHasData]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<FeedItem[]>([])
  const [coldStartLoading, setColdStartLoading] = useState(false)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [timeDays, setTimeDays] = useState(2)
  const handleTimeDaysChange = (d: number) => {
    sessionStorage.removeItem(FEED_CACHE_KEY)
    setActiveFilter(null)
    setTimeDays(d)
    timeDaysRef.current = d
  }
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const paginationAbortRef = useRef<AbortController | null>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<FeedItem[]>([])
  const timeDaysRef = useRef(2)
  const timeDaysMountedRef = useRef(false)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)

  const coldStartMessages = [
    'O Lophos está preparando o seu feed!',
    'Pode levar alguns minutos para você começar a ver os resultados.',
  ]

  const setPending = (next: FeedItem[] | ((prev: FeedItem[]) => FeedItem[])) => {
    setPendingItems(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      pendingRef.current = resolved
      return resolved
    })
  }

  const applyPendingUpdates = useCallback(() => {
    if (pendingItems.length === 0) return
    setItems(prev => mergeFeedItems(prev, pendingItems, true))
    setPending([])
    setUpdatesReady(false)
  }, [pendingItems, setUpdatesReady, setPending, setItems])

  useEffect(() => {
    onApplyUpdatesCallback.current = () => applyPendingUpdates()
  }, [onApplyUpdatesCallback, applyPendingUpdates])

  const setColdStart = (v: boolean) => {
    setColdStartLoading(v)
  }

  const fetchFeed = useCallback(async (force = false) => {
    // Serve do cache se não forçado e o cache ainda é válido
    if (!force) {
      try {
        const cached = readFeedCache(timeDaysRef.current)
        if (cached) {
          setItems(cached.items)
          setTopics(cached.topics)
          setActiveFilter(cached.activeFilter)
          setNextCursor(cached.nextCursor)
          nextCursorRef.current = cached.nextCursor
          setHasMore(cached.hasMore)
          hasMoreRef.current = cached.hasMore
          setHasData(true)
          setInitialized(true)
          setStreaming(false)
          return
        }
      } catch {}
    }

    abortRef.current?.abort()
    paginationAbortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStreaming(true)
    setError(null)
    setUpdatesReady(false)
    setPending([])
    setColdStart(false)
    setLoadMoreError(null)
    setNextCursor(null)
    nextCursorRef.current = null
    setHasMore(false)
    hasMoreRef.current = false
    if (force) {
      setItems([])
      setHasData(false)
      sessionStorage.removeItem(FEED_CACHE_KEY)
    }

    try {
      let page = await requestFeedPage({
        days: timeDaysRef.current,
        force,
        signal: ctrl.signal,
      })
      const firstPageTopics = page.topics
      for (let attempt = 0; attempt < 3 && page.items.length === 0 && page.hasMore && page.nextCursor; attempt += 1) {
        page = await requestFeedPage({
          days: timeDaysRef.current,
          cursor: page.nextCursor,
          signal: ctrl.signal,
        })
      }
      if (page.topics.length === 0) page.topics = firstPageTopics
      if (page.topics.length > 0) setTopics(page.topics)
      setItems(page.items)
      setHasData(page.items.length > 0)
      setColdStart(page.coldStart)
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      setHasMore(page.hasMore)
      hasMoreRef.current = page.hasMore
      setError(null)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[feed] request failed:', e)
        setError(e instanceof Error ? e.message : 'Erro ao carregar feed.')
      }
    } finally {
      setStreaming(false)
      setInitialized(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || !nextCursorRef.current) return

    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    const ctrl = new AbortController()
    paginationAbortRef.current = ctrl

    try {
      let cursor: string | null = nextCursorRef.current
      let page: FeedPageResponse | null = null

      // A page can become empty after the existing stale-launch protection. In
      // that rare case, advance over at most three candidate pages in one request
      // cycle so the sentinel cannot get stuck without visible cards.
      for (let attempt = 0; attempt < 3 && cursor; attempt += 1) {
        page = await requestFeedPage({
          days: timeDaysRef.current,
          cursor,
          signal: ctrl.signal,
        })
        cursor = page.nextCursor
        if (page.items.length > 0 || !page.hasMore) break
      }

      if (!page) return
      setItems(prev => mergeFeedItems(prev, page.items))
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      setHasMore(page.hasMore)
      hasMoreRef.current = page.hasMore
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[feed] next page failed:', e)
        setLoadMoreError(e instanceof Error ? e.message : 'Erro ao carregar mais notícias.')
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  // Register fetchFeed with the shared layout so Sidebar can trigger it
  useEffect(() => {
    onRefreshCallback.current = () => fetchFeed(true)
  }, [fetchFeed])

  useEffect(() => {
    if (!initialized || items.length === 0) return
    writeFeedCache({
      items,
      days: timeDays,
      nextCursor,
      hasMore,
      topics,
      activeFilter,
    })
  }, [activeFilter, hasMore, initialized, items, nextCursor, timeDays, topics])

  useEffect(() => { if (isLoaded && isSignedIn) fetchFeed() }, [isLoaded, isSignedIn])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      paginationAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => setTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetch('/api/reactions')
      .then(r => r.json())
      .then(data => setReactions(data.reactions ?? {}))
      .catch(() => {})
  }, [isLoaded, isSignedIn])
  useEffect(() => {
    if (!timeDaysMountedRef.current) { timeDaysMountedRef.current = true; return }
    if (isLoaded && isSignedIn) fetchFeed(true)
  }, [timeDays])

  // Poll for new articles every 5 minutes
  useEffect(() => {
    const POLL_INTERVAL = 5 * 60 * 1000
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
          const newItems = data.items as FeedItem[]
          setPending(newItems)
          setUpdatesReady(true)
        }
      } catch {}
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [items, topics, setUpdatesReady])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loadingMore || loadMoreError) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) void loadNextPage() },
      { root: scrollRef.current, rootMargin: '700px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasData, hasMore, loadMoreError, loadingMore, loadNextPage])

  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set())

  const handleReactionChange = (id: string, r: 'like' | 'dislike' | null) => {
    if (r === 'dislike') {
      setFadingOut(prev => new Set(prev).add(id))
      setTimeout(() => {
        setReactions(prev => ({ ...prev, [id]: 'dislike' }))
        setFadingOut(prev => { const s = new Set(prev); s.delete(id); return s })
      }, 400)
    } else {
      setReactions(prev => {
        const next = { ...prev }
        if (r === null) delete next[id]
        else next[id] = r
        return next
      })
    }
  }

  const visibleItems = items.filter(i => reactions[i.id] !== 'dislike')
  const filteredItems = activeFilter
    ? visibleItems.filter(i => {
        const itemTopic = toTitleCase(i.displayTopic ?? i.topic)
        return itemTopic === activeFilter || itemTopic.toLowerCase() === activeFilter.toLowerCase()
      })
    : visibleItems
  const topicsInFeed  = [...new Set(items.map(i => toTitleCase(i.displayTopic ?? i.topic)))]
  const allBlocks     = splitIntoBlocks(filteredItems)
  const showSkeleton  = !hasData && streaming
  const showStreaming = streaming && !hasData && !coldStartLoading
  const showEmpty     = initialized && !hasData && !streaming && !coldStartLoading
  const emptyMessage  = error
    ? (error.toLowerCase().includes('no topics')
        ? 'Nenhum tópico salvo. Selecione seus tópicos no onboarding ou em Configurações.'
        : error)
    : 'Nenhuma notícia encontrada.'


  return (
    <div id="feed-scroll-container" ref={scrollRef} className="editorial-page-scroll">
      <header className="editorial-feed-hero">
        <LophosLogo size={30} className="mb-5 md:hidden" />
        <h1>Em destaque no Lophos</h1>
        <p>O que suas fontes estão publicando agora</p>

        {hasData && topicsInFeed.length > 0 && (
          <div className="editorial-feed-controls" aria-label="Filtros do feed">
            <button
              type="button"
              onClick={() => { setActiveFilter(null); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className={cn('editorial-filter', activeFilter === null && 'is-active')}
            >
              Recentes
            </button>
            <TopicsDropdown
              topics={topicsInFeed}
              activeFilter={activeFilter}
              onSelect={(topic) => { setActiveFilter(topic); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
            <TimeFilterDropdown days={timeDays} onChange={handleTimeDaysChange} />
          </div>
        )}
      </header>

      <div className="editorial-feed-layout">
        <div id="feed-main-content" className="min-w-0 pb-28 md:pb-16">

              {coldStartLoading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-24 h-24 mb-6">
                    <FeedColdStartAnimation />
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
                <div className="editorial-card-stack">
                  <SkeletonBlock /><SkeletonBlock /><SkeletonBlock />
                </div>
              )}

              {showStreaming && (
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
                    type="button"
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
                  <button type="button" onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

          <div className="editorial-card-stack">
            {allBlocks.map((block, i) => (
              <FeedBlock key={block.items[0].id} items={block.items} blockIndex={i} reactions={reactions} fadingOut={fadingOut} onReactionChange={handleReactionChange} />
            ))}
            {hasData && hasMore && !loadMoreError && (
              <div ref={sentinelRef} aria-live="polite" aria-busy={loadingMore}>
                <SkeletonBlock />
              </div>
            )}
            {hasData && loadMoreError && (
              <div className="flex justify-center py-6" role="status">
                <button
                  type="button"
                  onClick={() => {
                    if (loadMoreError.toLowerCase().includes('cursor')) void fetchFeed(true)
                    else void loadNextPage()
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  Não foi possível carregar mais notícias. Tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
