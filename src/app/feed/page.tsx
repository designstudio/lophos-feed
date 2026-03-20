'use client'
import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { Feed } from '@solar-icons/react-perf/Linear'
import { NewsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

function FeedBlock({ items, isLast }: { items: NewsItem[]; isLast: boolean }) {
  if (items.length === 1) {
    return (
      <div className={cn('py-6', !isLast && 'border-b border-border')}>
        <NewsCard item={items[0]} variant="full-left" />
      </div>
    )
  }
  return (
    <div className={cn('py-6', !isLast && 'border-b border-border')}>
      <div className="grid grid-cols-3 gap-6">
        {items.map(item => <NewsCard key={item.id} item={item} variant="card" />)}
      </div>
    </div>
  )
}

function splitIntoBlocks(items: NewsItem[]): NewsItem[][] {
  const blocks: NewsItem[][] = []
  let i = 0
  while (i < items.length) {
    if (i % 4 === 0) { blocks.push([items[i]]); i++ }
    else if (i + 2 < items.length) { blocks.push([items[i], items[i+1], items[i+2]]); i += 3 }
    else { blocks.push([items[i]]); i++ }
  }
  return blocks
}

export default function FeedPage() {
  const [items, setItems]           = useState<NewsItem[]>([])
  const [topics, setTopics]         = useState<string[]>([])
  const [streaming, setStreaming]   = useState(false)
  const [hasData, setHasData]       = useState(false)  // true once first items arrive
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<'meu-feed' | 'topicos'>('meu-feed')
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)

  async function fetchFeed(force = false) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setStreaming(true)
    if (force) { setItems([]); setHasData(false) }

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: [], forceRefresh: force }),
        signal: ctrl.signal,
      })
      if (!res.body) return

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

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
            if (chunk.items?.length) {
              setItems(prev => {
                const ids = new Set(prev.map(x => x.id))
                const fresh = (chunk.items as NewsItem[]).filter(x => !ids.has(x.id))
                return fresh.length > 0 ? [...prev, ...fresh] : prev
              })
              setHasData(true)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      setStreaming(false)
    }
  }

  useEffect(() => { fetchFeed() }, [])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisibleBlocks(v => v + 4) },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasData]) // re-attach when content appears

  const filteredItems = activeFilter ? items.filter(i => i.topic === activeFilter) : items
  const topicsInFeed  = [...new Set(items.map(i => i.topic))]
  const allBlocks     = splitIntoBlocks(filteredItems)
  const shownBlocks   = allBlocks.slice(0, visibleBlocks)
  const hasMore       = visibleBlocks < allBlocks.length

  // Show skeletons while waiting for first data
  const showSkeleton  = !hasData && streaming
  // Show empty state only when done and truly nothing
  const showEmpty     = !hasData && !streaming

  return (
    <div className="page-shell">
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={streaming} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Fixed header ── */}
        <div className="flex-shrink-0 border-b border-border bg-bg-primary px-8">
          <div className="flex items-center h-14 gap-8">
            <h1 className="text-[15px] font-semibold text-ink-primary flex-shrink-0">Descobrir</h1>
            <div className="flex flex-1 justify-center gap-1">
              {(['meu-feed', 'topicos'] as const).map(tab => (
                <button key={tab}
                  onClick={() => { setActiveTab(tab as any); if (tab === 'meu-feed') setActiveFilter(null) }}
                  className={cn(
                    'text-[13px] px-4 h-14 border-b-2 transition-all font-medium',
                    activeTab === tab
                      ? 'border-ink-primary text-ink-primary'
                      : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
                  )}
                >
                  {tab === 'meu-feed' ? 'Meu Feed' : 'Tópicos'}
                </button>
              ))}
            </div>
            {/* spacer to balance title */}
            <div className="flex-shrink-0" style={{ width: '6rem' }} />
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="feed-layout mx-auto px-8 py-6 flex gap-10">

            <div className="flex-1 min-w-0">

              {/* Tópicos filter pills */}
              {activeTab === 'topicos' && topicsInFeed.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-5">
                  <button onClick={() => setActiveFilter(null)}
                    className={cn('text-[12px] px-3 py-1.5 rounded-full border transition-all',
                      activeFilter === null ? 'bg-ink-primary text-white border-ink-primary' : 'border-border text-ink-secondary hover:border-border-strong'
                    )}>
                    Todos
                  </button>
                  {topicsInFeed.map(t => (
                    <button key={t} onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                      className={cn('text-[12px] px-3 py-1.5 rounded-full border transition-all',
                        activeFilter === t ? 'bg-ink-primary text-white border-ink-primary' : 'border-border text-ink-secondary hover:border-border-strong'
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Skeleton — shown while fetching fresh content */}
              {showSkeleton && <><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></>}

              {/* Fetching indicator when we already have data but still streaming more */}
              {hasData && streaming && (
                <div className="flex items-center gap-2 text-xs text-ink-tertiary mb-4 px-1">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/>
                  </svg>
                  Buscando novidades…
                </div>
              )}

              {/* Empty state */}
              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <Feed size={32} className="text-ink-muted mb-4" />
                  <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                  <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Feed */}
              {shownBlocks.map((block, i) => (
                <FeedBlock key={i} items={block} isLast={i === shownBlocks.length - 1} />
              ))}

              {/* Infinite scroll */}
              {hasData && (
                <div ref={sentinelRef}>
                  {(hasMore || streaming) && <SkeletonBlock />}
                </div>
              )}
            </div>

            <div className="sidebar-right">
              <RightSidebar topics={topics} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
