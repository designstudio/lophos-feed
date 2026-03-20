'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { Feed } from '@solar-icons/react-perf/Linear'
import { NewsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

type FeedBlock =
  | { type: 'featured'; item: NewsItem }
  | { type: 'trio'; items: [NewsItem, NewsItem, NewsItem] }

function splitIntoBlocks(items: NewsItem[]): FeedBlock[] {
  const blocks: FeedBlock[] = []
  let i = 0
  while (i < items.length) {
    if (i % 4 === 0 && i + 1 < items.length) {
      blocks.push({ type: 'featured', item: items[i] })
      i++
    } else if (i + 2 < items.length) {
      blocks.push({ type: 'trio', items: [items[i], items[i + 1], items[i + 2]] })
      i += 3
    } else {
      blocks.push({ type: 'featured', item: items[i] })
      i++
    }
  }
  return blocks
}

function FeedBlock({ items, blockIndex }: { items: NewsItem[]; blockIndex: number }) {
  if (items.length === 1) {
    return <NewsCard item={items[0]} variant="full" />
  }
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      {items.map((item) => <NewsCard key={item.id} item={item} variant="card" />)}
    </div>
  )
}

export default function FeedPage() {
  const router = useRouter()
  const [items, setItems] = useState<NewsItem[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'para-voce' | 'topicos'>('para-voce')
  const [visibleBlocks, setVisibleBlocks] = useState(3)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchFeed = useCallback(async (force = false, topicsOverride?: string[]) => {
    setStreaming(true)
    if (force) { setItems([]); setLoading(true) }

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: topicsOverride ?? topics, forceRefresh: force }),
      })
      if (!res.body) return
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
              if (force) fetchFeed(false, t)
              continue
            }
            if (chunk.id) {
              setItems(prev => {
                if (prev.find(i => i.id === chunk.id)) return prev
                return [...prev, chunk]
              })
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
  }, [topics, router])

  useEffect(() => { fetchFeed() }, [])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisibleBlocks(v => v + 3)
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
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={streaming} />

      <div className="page-scroll">
        <div className="feed-layout mx-auto px-6 flex gap-10">

          <div className="flex-1 min-w-0 flex flex-col">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-bg-primary border-b border-border pt-6 pb-0 -mx-6 px-6">
              <h1 className="text-xl font-semibold text-ink-primary mb-3">Descobrir</h1>

              {/* Tabs */}
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

            {/* Topic filter pills — only shown in Tópicos tab */}
            {activeTab === 'topicos' && (
              <div className="flex gap-1.5 flex-wrap pt-4 pb-2">
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

            <div className="py-6">
              {loading && <><SkeletonBlock /><SkeletonBlock /></>}

              {!loading && items.length === 0 && !streaming && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <Feed size={32} className="text-ink-muted mb-4" />
                  <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                  <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                    Tentar novamente
                  </button>
                </div>
              )}

              {shownBlocks.map((block, i) => (
                <FeedBlock key={i} items={'item' in block ? [block.item] : [...block.items]} blockIndex={i} />
              ))}

              {filteredItems.length > 0 && (
                <div ref={sentinelRef}>
                  {(hasMore || streaming) && <SkeletonBlock />}
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-right pt-6">
            <RightSidebar topics={topics} />
          </div>
        </div>
      </div>
    </div>
  )
}
