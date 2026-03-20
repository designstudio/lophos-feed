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

const REFRESH_INTERVAL = 30 * 60 * 1000
const ITEMS_PER_BLOCK = 4 // 1 full + 3 cards

// One complete layout block: full-left + 3 cards + full-right
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

// Splits flat items array into blocks of ITEMS_PER_BLOCK
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
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // Lazy loading state — how many blocks are visible
  const [visibleBlocks, setVisibleBlocks] = useState(2)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => {
        const userTopics = (data.topics || []).map((t: any) => t.topic)
        if (userTopics.length === 0) { router.push('/onboarding'); return }
        setTopics(userTopics)
      })
      .catch(() => setLoading(false))
  }, [router])

  const fetchFeed = useCallback(async (force = false) => {
    if (topics.length === 0) return
    force ? setRefreshing(true) : setLoading(true)
    setVisibleBlocks(2) // reset lazy loading on refresh
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, forceRefresh: force }),
      })
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [topics])

  useEffect(() => { if (topics.length > 0) fetchFeed() }, [topics, fetchFeed])

  useEffect(() => {
    if (topics.length === 0) return
    const interval = setInterval(() => fetchFeed(true), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [topics, fetchFeed])

  // IntersectionObserver — load more blocks when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleBlocks((prev) => prev + 2)
        }
      },
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
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={refreshing} />

      <div className="page-scroll">
        <div className="feed-layout mx-auto px-6 py-6 flex gap-10">

          {/* Feed */}
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
                    <button
                      key={t}
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

            {/* Initial loading — 2 full skeleton blocks */}
            {loading && (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            )}

            {/* Empty state */}
            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Feed size={32} className="text-ink-muted mb-4" />
                <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Feed blocks — lazy loaded */}
            {!loading && shownBlocks.map((block, i) => (
              <FeedBlock key={i} items={block} blockIndex={i} />
            ))}

            {/* Sentinel + loading more skeleton */}
            {!loading && filteredItems.length > 0 && (
              <div ref={sentinelRef}>
                {hasMore && <SkeletonBlock />}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="sidebar-right pt-12">
            <RightSidebar topics={topics} />
          </div>

        </div>
      </div>
    </div>
  )
}
