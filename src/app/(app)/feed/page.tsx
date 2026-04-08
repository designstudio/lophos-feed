'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { LophosLogo } from '@/components/LophosLogo'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { IconFeed as Feed } from '@/components/icons'
import { Settings04 as Tuning2 } from '@untitledui/icons'
import Lottie from 'lottie-react'
import blogAnimation from '@/lib/animations/blog.json'
import { NewsItem } from '@/lib/types'
import { useFeedContext } from '@/components/FeedContext'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'

const toTitleCase = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function FeedBlock({ items, blockIndex, reactions, fadingOut, onReactionChange }: {
  items: NewsItem[]
  blockIndex: number
  reactions: Record<string, 'like' | 'dislike'>
  fadingOut: Set<string>
  onReactionChange: (id: string, r: 'like' | 'dislike' | null) => void
}) {
  const posInCycle = blockIndex % 3

  if (posInCycle !== 1) {
    const variant = posInCycle === 2 ? 'full-right' : 'full-left'
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant={variant} initialReaction={reactions[items[0].id] ?? null} fadingOut={fadingOut.has(items[0].id)} onReactionChange={onReactionChange} />
      </div>
    )
  }

  if (items.length === 1) {
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant="card" solo initialReaction={reactions[items[0].id] ?? null} fadingOut={fadingOut.has(items[0].id)} onReactionChange={onReactionChange} />
      </div>
    )
  }

  return (
    <div className="md:py-6 md:border-b md:border-border">
      <div className={cn('grid gap-0', items.length === 2 ? 'grid-cols-1 md:grid-cols-2 md:gap-8' : 'grid-cols-1 md:grid-cols-3 md:gap-4')}>
        {items.map(item => <NewsCard key={item.id} item={item} variant="card" initialReaction={reactions[item.id] ?? null} fadingOut={fadingOut.has(item.id)} onReactionChange={onReactionChange} />)}
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
          'flex items-center gap-1.5 text-[0.875rem] px-4 h-[60px] border-b-2 transition-all font-medium',
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
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-all spring-press',
          !isDefault
            ? 'border-ink-primary text-ink-primary bg-ink-primary/5'
            : 'border-border text-ink-tertiary hover:text-ink-secondary hover:border-border-strong'
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
  const [items, setItems]         = useState<NewsItem[]>([])
  const [topics, setTopics]       = useState<string[]>([])
  const [streaming, setStreamingLocal] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const setStreaming = (v: boolean) => { setStreamingLocal(v); setRefreshing(v) }
  const [hasData, setHasData]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pendingItems, setPendingItems] = useState<NewsItem[]>([])
  const [coldStartLoading, setColdStartLoading] = useState(false)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [timeDays, setTimeDays] = useState(2)
  const handleTimeDaysChange = (d: number) => {
    setTimeDays(d)
    timeDaysRef.current = d
  }
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const initialCacheAppliedRef = useRef(false)
  const pendingRef = useRef<NewsItem[]>([])
  const coldStartRef = useRef(false)
  const timeDaysRef = useRef(2)
  const timeDaysMountedRef = useRef(false)

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
        body: JSON.stringify({ topics: [], forceRefresh: force, days: timeDaysRef.current }),
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
      setInitialized(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Register fetchFeed with the shared layout so Sidebar can trigger it
  useEffect(() => {
    onRefreshCallback.current = () => fetchFeed(true)
  }, [fetchFeed])

  useEffect(() => { if (isLoaded && isSignedIn) fetchFeed() }, [isLoaded, isSignedIn])

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
          const newItems: NewsItem[] = data.items.map((row: any) => ({
            id: row.id, topic: row.topic, title: row.title, summary: row.summary,
            sections: row.sections || [], conclusion: row.conclusion || undefined,
            sources: row.sources, imageUrl: row.image_url, videoUrl: row.video_url,
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
  const shownBlocks   = allBlocks.slice(0, visibleBlocks)
  const hasMore       = visibleBlocks < allBlocks.length
  const showSkeleton  = !hasData && streaming
  const showEmpty     = initialized && !hasData && !streaming && !coldStartLoading
  const emptyMessage  = error
    ? (error.toLowerCase().includes('no topics')
        ? 'Nenhum tópico salvo. Selecione seus tópicos no onboarding ou em Configurações.'
        : error)
    : 'Nenhuma notícia encontrada.'


  return (
    <div id="feed-scroll-container" ref={scrollRef} className="flex-1 overflow-y-auto min-w-0">

        {/* ── Sticky header ── */}
        <div className="app-header-shell">
          <div className="app-header-inner">

          {/* Mobile: title (always visible) */}
          <div className="app-header-pill header-blur flex items-center px-4 md:hidden gap-2">
            <LophosLogo size={28} />
            <h1 className="text-[15px] font-semibold text-ink-primary">Meu Feed</h1>
          </div>

          {/* Mobile: horizontal scrollable tabs (only if has data) */}
          {hasData && topicsInFeed.length > 0 && (
            <div className="flex md:hidden overflow-x-auto no-scrollbar gap-2 px-1 pt-3"
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
            <div className="app-header-pill header-blur hidden md:flex items-center px-5">
              <h1 className="text-[15px] font-semibold text-ink-primary flex-shrink-0" style={{ width: '12rem' }}>Meu Feed</h1>
              <div className="flex flex-1 justify-center">
                <button
                  onClick={() => { setActiveFilter(null); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className={cn(
                    'text-[0.875rem] px-4 h-[60px] border-b-2 transition-all font-medium',
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
              <div style={{ width: '12rem' }} className="flex justify-end">
                <TimeFilterDropdown days={timeDays} onChange={handleTimeDaysChange} />
              </div>
            </div>
          )}

          {/* Desktop: skeleton while loading, title only when no data */}
          {(!hasData || topicsInFeed.length === 0) && (
            <div className="app-header-pill header-blur hidden md:flex items-center px-5">
              <h1 className="text-[15px] font-semibold text-ink-primary flex-shrink-0" style={{ width: '12rem' }}>Meu Feed</h1>
              {streaming && (
                <>
                  <div className="flex flex-1 justify-center gap-2">
                    <div className="skeleton h-4 w-28 rounded-full" />
                    <div className="skeleton h-4 w-20 rounded-full" />
                  </div>
                  <div style={{ width: '12rem' }} className="flex justify-end">
                    <div className="skeleton h-7 w-24 rounded-lg" />
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>

        {/* ── Feed + Right sidebar ── */}
        <div className="feed-layout mx-auto px-4 md:px-8">
          <div id="feed-main-content" className="flex gap-10 pt-0 pb-24 md:py-6 md:pb-6">
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
                <FeedBlock key={block.items[0].id} items={block.items} blockIndex={i} reactions={reactions} fadingOut={fadingOut} onReactionChange={handleReactionChange} />
              ))}

              {hasData && (
                <div ref={sentinelRef}>
                  {hasMore && <SkeletonBlock />}
                </div>
              )}
            </div>

            <RightSidebar topics={topics} />
          </div>
        </div>
      </div>
  )
}

