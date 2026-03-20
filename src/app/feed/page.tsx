'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { Feed } from '@solar-icons/react-perf/Linear'

export const dynamic = 'force-dynamic'

const REFRESH_INTERVAL = 30 * 60 * 1000

// Renders items in the Perplexity pattern:
// [full-left] [card card card] [full-right] → repeat
function FeedLayout({ items }: { items: NewsItem[] }) {
  const blocks: React.ReactNode[] = []
  let i = 0
  let cycle = 0 // 0 = full-left, 1 = full-right

  while (i < items.length) {
    // 1 full row (alternates left/right)
    if (i < items.length) {
      const variant = cycle % 2 === 0 ? 'full-left' : 'full-right'
      blocks.push(
        <div key={`full-${i}`} className="py-6 border-b border-border">
          <NewsCard item={items[i]} variant={variant} />
        </div>
      )
      i++
    }

    // 3 card grid
    const cardSlice = items.slice(i, i + 3)
    if (cardSlice.length > 0) {
      blocks.push(
        <div key={`cards-${i}`} className="grid grid-cols-3 gap-5 py-6 border-b border-border">
          {cardSlice.map((item) => (
            <NewsCard key={item.id} item={item} variant="card" />
          ))}
        </div>
      )
      i += cardSlice.length
    }

    cycle++
  }

  return <div>{blocks}</div>
}

export default function FeedPage() {
  const router = useRouter()
  const [topics, setTopics] = useState<string[]>([])
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

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

  const filteredItems = activeFilter ? items.filter((i) => i.topic === activeFilter) : items
  const topicsInFeed = [...new Set(items.map((i) => i.topic))]

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={refreshing} />

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[1136px] mx-auto px-6 py-6 flex gap-10">

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

            {loading && (
              <div className="space-y-0">
                <div className="py-6 border-b border-border"><SkeletonCard featured /></div>
                <div className="grid grid-cols-3 gap-5 py-6 border-b border-border">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="py-6 border-b border-border"><SkeletonCard featured /></div>
                <div className="grid grid-cols-3 gap-5 py-6 border-b border-border">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Feed size={32} className="text-ink-muted mb-4" />
                <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {!loading && filteredItems.length > 0 && (
              <FeedLayout items={filteredItems} />
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-[336px] flex-shrink-0 pt-12">
            <RightSidebar topics={topics} />
          </div>

        </div>
      </div>
    </div>
  )
}
