'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { NewsCard } from '@/components/NewsCard'
import { LophosLogo } from '@/components/LophosLogo'
import { FeedViewSwitcher } from '@/components/FeedViewSwitcher'
import { FeedUpdatesNotice } from '@/components/feed/FeedUpdatesNotice'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { IconFeed as Feed } from '@/components/icons'
import { FeedItem } from '@/lib/types'
import { useFeedContext } from '@/components/FeedContext'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'
import { FEED_CACHE_MAX_ITEMS, FEED_CACHE_VERSION } from '@/lib/feed-pagination-config'
import { useDropdownTransition } from '@/hooks/useDropdownTransition'
import { useFeedUpdates } from '@/hooks/useFeedUpdates'
import { useRelevantEditorialLists } from '@/hooks/useRelevantEditorialLists'
import { interleaveEditorialLists } from '@/lib/mixed-feed'
import { EditorialListShowcaseCard } from '@/components/editorial/EditorialListShowcaseCard'

const toTitleCase = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
const TOPIC_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

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
  nextCursor: string | null
  hasMore: boolean
  topics: string[]
  activeFilter: string | null
  scrollTop: number
}

function readFeedCache(): FeedCache | null {
  const serialized = sessionStorage.getItem(FEED_CACHE_KEY)
  if (!serialized) return null

  try {
    const cache = JSON.parse(serialized) as Partial<FeedCache>
    const isCurrent = cache.version === FEED_CACHE_VERSION
      && typeof cache.timestamp === 'number'
      && Date.now() - cache.timestamp < FEED_CACHE_TTL
      && Array.isArray(cache.items)
      && cache.items.length > 0
      && cache.items.length <= FEED_CACHE_MAX_ITEMS
      && (typeof cache.nextCursor === 'string' || cache.nextCursor === null)
      && typeof cache.hasMore === 'boolean'
      && Array.isArray(cache.topics)
      && cache.topics.every((topic) => typeof topic === 'string')
      && (typeof cache.activeFilter === 'string' || cache.activeFilter === null)
      && typeof cache.scrollTop === 'number'
      && Number.isFinite(cache.scrollTop)
      && cache.scrollTop >= 0

    if (isCurrent) {
      const currentCache = cache as FeedCache
      return {
        ...currentCache,
        nextCursor: currentCache.items.length < FEED_CACHE_MAX_ITEMS ? currentCache.nextCursor : null,
        hasMore: currentCache.hasMore && currentCache.items.length < FEED_CACHE_MAX_ITEMS,
      }
    }
  } catch {}

  sessionStorage.removeItem(FEED_CACHE_KEY)
  return null
}

function writeFeedScrollTop(scrollTop: number) {
  try {
    const serialized = sessionStorage.getItem(FEED_CACHE_KEY)
    if (!serialized) return
    const cache = JSON.parse(serialized) as Partial<FeedCache>
    if (cache.version !== FEED_CACHE_VERSION) return
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ ...cache, scrollTop }))
  } catch {}
}

function writeFeedCache(cache: Omit<FeedCache, 'version' | 'timestamp'>) {
  if (cache.items.length === 0 || cache.items.length > FEED_CACHE_MAX_ITEMS) return

  try {
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      ...cache,
      nextCursor: cache.items.length < FEED_CACHE_MAX_ITEMS ? cache.nextCursor : null,
      hasMore: cache.hasMore && cache.items.length < FEED_CACHE_MAX_ITEMS,
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
  topic,
  cursor,
  force,
  signal,
}: {
  topic?: string | null
  cursor?: string | null
  force?: boolean
  signal: AbortSignal
}): Promise<FeedPageResponse> {
  const response = await fetch('/api/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topics: topic ? [topic] : [],
      forceRefresh: Boolean(force),
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

function TopicsDropdown({ topics, activeFilter, onSelect }: {
  topics: string[]
  activeFilter: string | null
  onSelect: (t: string | null) => void
}) {
  const { open, closing, closeDropdown, toggleDropdown } = useDropdownTransition()
  const [scrollState, setScrollState] = useState({ canScrollUp: false, canScrollDown: false })
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const updateScrollState = useCallback(() => {
    const list = listRef.current
    if (!list) return

    const overflowing = list.scrollHeight > list.clientHeight + 1
    setScrollState({
      canScrollUp: overflowing && list.scrollTop > 1,
      canScrollDown: overflowing && list.scrollTop + list.clientHeight < list.scrollHeight - 1,
    })
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [closeDropdown])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return

    const frame = requestAnimationFrame(updateScrollState)
    list.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      cancelAnimationFrame(frame)
      list.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [activeFilter, open, topics.length, updateScrollState])

  const scrollTopics = (direction: -1 | 1) => {
    listRef.current?.scrollBy({ top: direction * 160, behavior: 'smooth' })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        aria-expanded={open}
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

      <div
        className={cn(
          't-dropdown absolute top-full left-0 mt-1 flex w-56 flex-col overflow-hidden rounded-xl border border-border bg-[var(--color-bg-elevated)] py-1 shadow-[0_4px_12px_#0000000d] z-50',
          open && 'is-open',
          closing && 'is-closing',
        )}
        data-origin="top-left"
        aria-hidden={!open}
        inert={!open}
      >
          {scrollState.canScrollUp && (
            <div className="topics-dropdown__scroll-cue topics-dropdown__scroll-cue--top">
              <button
                type="button"
                className="topics-dropdown__scroll-button"
                onClick={() => scrollTopics(-1)}
                aria-label="Rolar tópicos para cima"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3.5 8.5 7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          <div ref={listRef} className="topics-dropdown__list max-h-72 overflow-y-auto px-1.5">
            {activeFilter && (
              <button
                type="button"
                onClick={() => { onSelect(null); closeDropdown() }}
                className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-ink-tertiary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Ver todos
              </button>
            )}
            {topics.map(t => (
              <button key={t}
                type="button"
                onClick={() => { onSelect(t); closeDropdown() }}
                className={cn(
                  'flex w-full items-center rounded-lg px-4 py-2.5 text-left text-sm transition-colors',
                  activeFilter === t
                    ? 'bg-[var(--color-hover-elevated)] font-medium text-ink-primary'
                    : 'text-ink-secondary hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {scrollState.canScrollDown && (
            <div className="topics-dropdown__scroll-cue topics-dropdown__scroll-cue--bottom">
              <button
                type="button"
                className="topics-dropdown__scroll-button"
                onClick={() => scrollTopics(1)}
                aria-label="Rolar tópicos para baixo"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="m3.5 5.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

      </div>
    </div>
  )
}

export default function ListFeedView() {
  const { isLoaded, isSignedIn } = useAuth()
  const { setRefreshing, onRefreshCallback, setUpdatesReady, setPendingFeedItems } = useFeedContext()
  const [items, setItems]         = useState<FeedItem[]>([])
  const [topics, setTopics]       = useState<string[]>([])
  const [streaming, setStreamingLocal] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const setStreaming = (v: boolean) => { setStreamingLocal(v); setRefreshing(v) }
  const [hasData, setHasData]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [coldStartLoading, setColdStartLoading] = useState(false)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const editorialLists = useRelevantEditorialLists(activeFilter)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const paginationAbortRef = useRef<AbortController | null>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const activeFilterRef = useRef<string | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const scrollTopRef = useRef(0)
  const restoredScrollTopRef = useRef<number | null>(null)
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigatingToArticleRef = useRef(false)
  const restoringScrollRef = useRef(false)

  const coldStartMessages = [
    'O Lophos está preparando o seu feed!',
    'Pode levar alguns minutos para você começar a ver os resultados.',
  ]

  const setColdStart = (v: boolean) => {
    setColdStartLoading(v)
  }

  const fetchFeed = useCallback(async (force = false) => {
    // Serve do cache se não forçado e o cache ainda é válido
    if (!force) {
      try {
        const cached = readFeedCache()
        if (cached) {
          setItems(cached.items)
          setTopics(cached.topics)
          setActiveFilter(cached.activeFilter)
          activeFilterRef.current = cached.activeFilter
          restoredScrollTopRef.current = cached.scrollTop
          restoringScrollRef.current = cached.scrollTop > 0
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
    setPendingFeedItems([])
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
        topic: activeFilterRef.current,
        force,
        signal: ctrl.signal,
      })
      const firstPageTopics = page.topics
      for (let attempt = 0; attempt < 3 && page.items.length === 0 && page.hasMore && page.nextCursor; attempt += 1) {
        page = await requestFeedPage({
          topic: activeFilterRef.current,
          cursor: page.nextCursor,
          signal: ctrl.signal,
        })
      }
      if (page.topics.length === 0) page.topics = firstPageTopics
      if (page.topics.length > 0 && activeFilterRef.current === null) setTopics(page.topics)
      setItems(page.items)
      setHasData(page.items.length > 0)
      setColdStart(page.coldStart)
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      const canLoadMore = page.hasMore && page.items.length < FEED_CACHE_MAX_ITEMS
      setHasMore(canLoadMore)
      hasMoreRef.current = canLoadMore
      setError(null)
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[feed] request failed:', e)
        setError(e instanceof Error ? e.message : 'Erro ao carregar feed.')
      }
    } finally {
      // Uma chamada mais recente pode ter abortado esta requisição. Nesse
      // caso, somente a chamada ativa deve encerrar o loading; caso contrário,
      // o estado vazio pisca enquanto o novo feed ainda está em andamento.
      if (abortRef.current === ctrl) {
        setStreaming(false)
        setInitialized(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadNextPage = useCallback(async () => {
    if (items.length >= FEED_CACHE_MAX_ITEMS) {
      setHasMore(false)
      hasMoreRef.current = false
      setNextCursor(null)
      nextCursorRef.current = null
      return
    }

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
          topic: activeFilterRef.current,
          cursor,
          signal: ctrl.signal,
        })
        cursor = page.nextCursor
        if (page.items.length > 0 || !page.hasMore) break
      }

      if (!page) return
      const reachedLimit = items.length + page.items.length >= FEED_CACHE_MAX_ITEMS
      setItems(prev => mergeFeedItems(prev, page.items).slice(0, FEED_CACHE_MAX_ITEMS))
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      const canLoadMore = page.hasMore && !reachedLimit
      setHasMore(canLoadMore)
      hasMoreRef.current = canLoadMore
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[feed] next page failed:', e)
        setLoadMoreError(e instanceof Error ? e.message : 'Erro ao carregar mais notícias.')
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [items.length])

  // Register fetchFeed with the shared layout so Sidebar can trigger it
  useEffect(() => {
    onRefreshCallback.current = () => fetchFeed(true)
  }, [fetchFeed])

  useEffect(() => {
    if (!initialized || restoredScrollTopRef.current === null || !scrollRef.current) return
    const targetScrollTop = restoredScrollTopRef.current
    const applyScrollPosition = () => {
      if (!scrollRef.current) return
      scrollRef.current.scrollTop = targetScrollTop
      scrollTopRef.current = targetScrollTop
    }
    const frame = requestAnimationFrame(applyScrollPosition)
    const settleTimeout = setTimeout(() => {
      applyScrollPosition()
      restoredScrollTopRef.current = null
      restoringScrollRef.current = false
    }, 250)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimeout)
    }
  }, [initialized, items.length])

  useEffect(() => {
    if (!initialized || items.length === 0) return
    writeFeedCache({
      items,
      nextCursor,
      hasMore,
      topics,
      activeFilter,
      scrollTop: scrollRef.current?.scrollTop ?? scrollTopRef.current,
    })
  }, [activeFilter, hasMore, initialized, items, nextCursor, topics])

  useEffect(() => {
    if (items.length < FEED_CACHE_MAX_ITEMS) return
    setHasMore(false)
    hasMoreRef.current = false
    setNextCursor(null)
    nextCursorRef.current = null
  }, [items.length])

  useEffect(() => { if (isLoaded && isSignedIn) fetchFeed() }, [isLoaded, isSignedIn])

  useEffect(() => {
    navigatingToArticleRef.current = false
    return () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
      if (!navigatingToArticleRef.current && !restoringScrollRef.current) {
        writeFeedScrollTop(scrollTopRef.current)
      }
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
  const applyFeedUpdates = useCallback((newItems: FeedItem[]) => {
    setItems((current) => mergeFeedItems(current, newItems, true).slice(0, FEED_CACHE_MAX_ITEMS))
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    scrollTopRef.current = 0
  }, [])

  useFeedUpdates({
    items,
    topics: activeFilter ? [activeFilter] : topics,
    onApplyUpdates: applyFeedUpdates,
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loadingMore || loadMoreError) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) void loadNextPage() },
      { root: scrollRef.current, rootMargin: '1600px 0px', threshold: 0.01 },
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
  const filteredItems = visibleItems
  const filterTopics  = [...new Set(topics.map(toTitleCase))].sort(TOPIC_COLLATOR.compare)
  const mixedFeedItems = interleaveEditorialLists(filteredItems, editorialLists.items)
  const showSkeleton  = !hasData && streaming
  const showFeedSkeleton = showSkeleton && !coldStartLoading
  const showStreaming = streaming && !hasData && !coldStartLoading
  const showEmpty     = initialized && !hasData && !streaming && !coldStartLoading
  const emptyMessage  = error
    ? (error.toLowerCase().includes('no topics')
        ? 'Nenhum tópico salvo. Selecione seus tópicos no onboarding ou em Configurações.'
        : error)
    : 'Nenhuma notícia encontrada.'

  const selectTopic = (topic: string | null) => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    if (activeFilterRef.current === topic) return
    activeFilterRef.current = topic
    setActiveFilter(topic)
    sessionStorage.removeItem(FEED_CACHE_KEY)
    void fetchFeed(true)
  }


  return (
    <div
      id="feed-scroll-container"
      ref={scrollRef}
      className="editorial-page-scroll"
      onClickCapture={(event) => {
        const target = event.target as Element
        if (!target.closest('a[href^="/article/"]')) return
        navigatingToArticleRef.current = true
        if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
        scrollSaveTimeoutRef.current = null
        writeFeedScrollTop(scrollTopRef.current)
      }}
      onScroll={(event) => {
        if (navigatingToArticleRef.current || restoringScrollRef.current) return
        scrollTopRef.current = event.currentTarget.scrollTop
        const remaining = event.currentTarget.scrollHeight - event.currentTarget.scrollTop - event.currentTarget.clientHeight
        if (remaining <= event.currentTarget.clientHeight * 2) void loadNextPage()
        if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
        scrollSaveTimeoutRef.current = setTimeout(() => {
          writeFeedScrollTop(scrollTopRef.current)
          scrollSaveTimeoutRef.current = null
        }, 150)
      }}
    >
      <header className="feed-view-header">
        <div className="feed-view-header__filters">
          <LophosLogo size={30} className="md:hidden" />
          <div className="editorial-feed-controls" aria-label="Filtros do feed">
            <button
              type="button"
              onClick={() => selectTopic(null)}
              className={cn('editorial-filter', activeFilter === null && 'is-active')}
            >
              Recentes
            </button>
            <TopicsDropdown
              topics={filterTopics}
              activeFilter={activeFilter}
              onSelect={selectTopic}
            />
            <FeedUpdatesNotice />
          </div>
        </div>
        <FeedViewSwitcher current="list" />
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

              {showStreaming && (
                <div className="flex items-center gap-2 text-xs text-ink-tertiary mb-4 px-1">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                  </svg>
                  Buscando novidades…
                </div>
              )}

              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <Feed size={32} className="text-ink-muted mb-4" />
                  <p className="text-ink-secondary">{emptyMessage}</p>
                  <button type="button" onClick={() => fetchFeed(true)} className="mt-4 text-sm text-ink-primary hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

          {(showFeedSkeleton || hasData) && (
            <div
              key={activeFilter ?? 'recentes'}
              className={cn(
                't-skel t-skel--flow',
                showFeedSkeleton && 'is-resetting',
                hasData && 'is-revealed',
              )}
              data-state={showFeedSkeleton ? 'loading' : 'loaded'}
              aria-busy={showFeedSkeleton}
            >
              <div className="t-skel-skeleton is-pulsing" aria-hidden={hasData}>
                <div className="editorial-card-stack">
                  <SkeletonBlock /><SkeletonBlock /><SkeletonBlock />
                </div>
              </div>

              <div className="t-skel-content" aria-hidden={!hasData} inert={!hasData}>
                <div className="editorial-card-stack">
                  {mixedFeedItems.map((entry, index) => entry.kind === 'article' ? (
                    <FeedBlock
                      key={entry.item.id}
                      items={[entry.item]}
                      blockIndex={index}
                      reactions={reactions}
                      fadingOut={fadingOut}
                      onReactionChange={handleReactionChange}
                    />
                  ) : (
                    <EditorialListShowcaseCard
                      key={`list-${entry.item.id}`}
                      list={entry.item}
                      animationIndex={index}
                      variant="feature"
                      label="editorial-list"
                      initialReaction={editorialLists.reactions[entry.item.id] ?? null}
                      onReactionChange={editorialLists.onReactionChange}
                    />
                  ))}
                  {hasData && hasMore && items.length < FEED_CACHE_MAX_ITEMS && !loadMoreError && (
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
                        className="text-sm text-ink-primary hover:underline"
                      >
                        Não foi possível carregar mais notícias. Tentar novamente
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
