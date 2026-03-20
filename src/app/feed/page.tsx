'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { Feed } from '@solar-icons/react-perf/Linear'
import { NewsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

function FeedBlock({ items }: { items: NewsItem[] }) {
  if (items.length === 1) {
    return <NewsCard item={items[0]} variant="full-left" />
  }
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      {items.map(item => <NewsCard key={item.id} item={item} variant="card" />)}
    </div>
  )
}

function splitIntoBlocks(items: NewsItem[]): NewsItem[][] {
  const blocks: NewsItem[][] = []
  let i = 0
  while (i < items.length) {
    if (i % 4 === 0) {
      blocks.push([items[i]])
      i++
    } else if (i + 2 < items.length) {
      blocks.push([items[i], items[i + 1], items[i + 2]])
      i += 3
    } else {
      blocks.push([items[i]])
      i++
    }
  }
  return blocks
}

export default function FeedPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'para-voce' | 'topicos'>('para-voce')
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const fetchedRef = useRef(false)

  const fetchFeed = useCallback(async (force = false, resolvedTopics?: string[]) => {
    if (streaming && !force) return
    setStreaming(true)
    if (force) { setItems([]); setLoading(true) }

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: resolvedTopics ?? topics, forceRefresh: force }),
      })
      if (!res.body) { setLoading(false); setStreaming(false); return }
      const reader = res.body.getReader()
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
            if (chunk.topics) {
              const t = chunk.topics as string[]
              setTopics(t)
              continue
            }
            // API sends {items: [...]} batches
            if (chunk.items && Array.isArray(chunk.items)) {
              setItems(prev => {
                const ids = new Set(prev.map(x => x.id))
                const newItems = chunk.items.filter((x: NewsItem) => !ids.has(x.id))
                return newItems.length > 0 ? [...prev, ...newItems] : prev
              })
              setLoading(false)
              continue
            }
            // Also handle single item {id:...}
            if (chunk.id) {
              setItems(prev => prev.find(x => x.id === chunk.id) ? prev : [...prev, chunk])
              setLoading(false)
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setStreaming(false)
      setLoading(false)
    }
  }, []) // no deps — uses ref for one-shot

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchFeed()
  }, [fetchFeed])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisibleBlocks(v => v + 4)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [])

  const filteredItems = activeFilter ? items.filter(i => i.topic === activeFilter) : items
  const topicsInFeed = [...new Set(items.map(i => i.topic))]
  const allBlocks = splitIntoBlocks(filteredItems)
  const shownBlocks = allBlocks.slice(0, visibleBlocks)
  const hasMore = visibleBlocks < allBlocks.length

  return (
    <div className="page-shell">
      <Sidebar onRefresh={() => { fetchedRef.current = false; fetchFeed(true) }} refreshing={streaming} />

      {/* Main area — full height column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Sticky header — outside of scroll ── */}
        <div className="flex-shrink-0 border-b border-border bg-bg-primary px-8 pt-5 pb-0">
          <h1 className="text-xl font-semibold text-ink-primary mb-3">Descobrir</h1>
          <div className="flex gap-0">
            <button
              onClick={() => { setActiveTab('para-voce'); setActiveFilter(null) }}
              className={cn(
                'text-[13px] px-4 py-2.5 border-b-2 transition-all font-medium',
                activeTab === 'para-voce'
                  ? 'border-ink-primary text-ink-primary'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
              )}
            >
              Para Você
            </button>
            <button
              onClick={() => setActiveTab('topicos')}
              className={cn(
                'text-[13px] px-4 py-2.5 border-b-2 transition-all font-medium',
                activeTab === 'topicos'
                  ? 'border-ink-primary text-ink-primary'
                  : 'border-transparent text-ink-tertiary hover:text-ink-secondary'
              )}
            >
              Tópicos
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="feed-layout mx-auto px-8 py-6 flex gap-10">

            <div className="flex-1 min-w-0">
              {/* Topic filter pills — Tópicos tab */}
              {activeTab === 'topicos' && topicsInFeed.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-5">
                  <button
                    onClick={() => setActiveFilter(null)}
                    className={cn(
                      'text-[12px] px-3 py-1.5 rounded-full border transition-all',
                      activeFilter === null
                        ? 'bg-ink-primary text-white border-ink-primary'
                        : 'border-border text-ink-secondary hover:border-border-strong'
                    )}
                  >
                    Todos
                  </button>
                  {topicsInFeed.map(t => (
                    <button key={t}
                      onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                      className={cn(
                        'text-[12px] px-3 py-1.5 rounded-full border transition-all',
                        activeFilter === t
                          ? 'bg-ink-primary text-white border-ink-primary'
                          : 'border-border text-ink-secondary hover:border-border-strong'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading skeleton */}
              {loading && <><SkeletonBlock /><SkeletonBlock /></>}

              {/* Empty state */}
              {!loading && items.length === 0 && !streaming && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <Feed size={32} className="text-ink-muted mb-4" />
                  <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                  <button onClick={() => { fetchedRef.current = false; fetchFeed(true) }}
                    className="mt-4 text-sm text-accent hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Feed blocks */}
              {shownBlocks.map((block, i) => (
                <FeedBlock key={i} items={block} />
              ))}

              {/* Infinite scroll sentinel */}
              {filteredItems.length > 0 && (
                <div ref={sentinelRef}>
                  {(hasMore || streaming) && <SkeletonBlock />}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="sidebar-right">
              <RightSidebar topics={topics} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
