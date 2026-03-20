'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { Feed } from '@solar-icons/react-perf/Linear'

export const dynamic = 'force-dynamic'

const ITEMS_PER_BLOCK = 4

function FeedBlock({ items, blockIndex }: { items: NewsItem[]; blockIndex: number }) {
  const full = blockIndex % 2 === 0 ? 'full-left' : 'full-right'
  const [featured, ...cards] = items
  return (
    <div className="animate-slide-up">
      {featured && (
        <div className="py-6 border-b border-border">
          <NewsCard item={featured} variant={full} />
        </div>
      )}
      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-5 py-6 border-b border-border">
          {cards.map((item) => (
            <NewsCard key={item.id} item={item} variant="card" />
          ))}
        </div>
      )}
    </div>
  )
}

function splitIntoBlocks(items: NewsItem[]): NewsItem[][] {
  const blocks: NewsItem[][] = []
  for (let i = 0; i < items.length; i += ITEMS_PER_BLOCK) {
    blocks.push(items.slice(i, i + ITEMS_PER_BLOCK))
  }
  return blocks
}

export default function FeedPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<string[]>([])
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)   // true = no items yet
  const [streaming, setStreaming] = useState(false) // true = still receiving
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [visibleBlocks, setVisibleBlocks] = useState(2)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => {
        const userTopics = (data.topics || []).map((t: any) => t.topic)
        if (userTopics.length === 0) { router.push('/onboarding'); return }
        setTopics(userTopics)
      })
  }, [router])

  const fetchFeed = useCallback(async (force = false) => {
    if (topics.length === 0) return

    // Cancel previous in-flight request
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setItems([])
    setVisibleBlocks(2)
    setStreaming(true)

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, forceRefresh: force }),
        signal: ctrl.signal,
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
            if (chunk.items?.length) {
              setItems((prev) => {
                // Deduplicate by id
                const ids = new Set(prev.map((i) => i.id))
                const newItems = chunk.items.filter((i: NewsItem) => !ids.has(i.id))
                return [...prev, ...newItems]
              })
              setLoading(false) // first chunk arrived — hide skeleton
            }
          } catch { /* malformed chunk, skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }, [topics])

  useEffect(() => { if (topics.length > 0) fetchFeed() }, [topics, fetchFeed])

  // Lazy loading sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleBlocks((p) => p + 2) },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items])

  const filteredItems = activeFilter ? items.filter((i) => i.topic === activeFilter) : items
  const topicsInFeed = [...new Set(items.map((i) => i.topic))]
  const allBlocks = splitIntoBlocks(filteredItems)
  const shownBlocks = allBlocks.slice(0, visibleBlocks)
  const hasMore = visibleBlocks < allBlocks.length

  return (
    <div className="page-shell">
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={streaming} />

      <div className="page-scroll">
        <div className="feed-layout mx-auto px-6 py-6 flex gap-10">
          <div className="flex-1 min-w-0">
            <div className="mb-5">
              <h1 className="text-xl font-semibold text-ink-primary mb-3">Descobrir</h1>
              {topicsInFeed.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveFilter(null)}
                    className={`text-[12px] px-3 py-1.5 rounded-full border transition-all ${
                      activeFilter === null
                        ? 'bg-ink-primary text-white border-ink-primary'
                        : 'border-border text-ink-secondary hover:border-border-strong'
                    }`}
                  >
                    Para Você
                  </button>
                  {topicsInFeed.map((t) => (
                    <button key={t}
                      onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                      className={`text-[12px] px-3 py-1.5 rounded-full border transition-all ${
                        activeFilter === t
                          ? 'bg-ink-primary text-white border-ink-primary'
                          : 'border-border text-ink-secondary hover:border-border-strong'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skeleton — shown until first chunk arrives */}
            {loading && (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            )}

            {/* Empty state */}
            {!loading && items.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Feed size={32} className="text-ink-muted mb-4" />
                <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Feed blocks */}
            {shownBlocks.map((block, i) => (
              <FeedBlock key={i} items={block} blockIndex={i} />
            ))}

            {/* Sentinel + load more skeleton */}
            {filteredItems.length > 0 && (
              <div ref={sentinelRef}>
                {(hasMore || streaming) && <SkeletonBlock />}
              </div>
            )}
          </div>

          <div className="sidebar-right pt-12">
            <RightSidebar topics={topics} />
          </div>
        </div>
      </div>
    </div>
  )
}
