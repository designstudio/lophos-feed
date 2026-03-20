'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { Rss } from '@solar-icons/react-perf/Linear'

export const dynamic = 'force-dynamic'

const REFRESH_INTERVAL = 30 * 60 * 1000

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
  const featured = filteredItems[0]
  const secondary = filteredItems.slice(1, 4)
  const rest = filteredItems.slice(4)

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Left sidebar — fixed */}
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={refreshing} />

      {/* Scrollable area — feed + right sidebar together */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[1136px] mx-auto px-6 py-6 flex gap-10">

          {/* Feed — main column */}
          <div className="flex-1 min-w-0">
            {/* Header + filters */}
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

            {/* Loading */}
            {loading && (
              <div className="space-y-8">
                <div className="pb-8 border-b border-border"><SkeletonCard featured /></div>
                <div className="grid grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
                <div className="space-y-6"><SkeletonCard featured /><SkeletonCard featured /></div>
              </div>
            )}

            {/* Empty */}
            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Rss size={32} className="text-ink-muted mb-4" />
                <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
                <button onClick={() => fetchFeed(true)} className="mt-4 text-sm text-accent hover:underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Feed */}
            {!loading && filteredItems.length > 0 && (
              <div className="stagger">
                {featured && (
                  <div className="pb-6 border-b border-border mb-6 animate-slide-up">
                    <NewsCard item={featured} featured />
                  </div>
                )}
                {secondary.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 pb-6 border-b border-border mb-6 animate-slide-up">
                    {secondary.map((item) => <NewsCard key={item.id} item={item} />)}
                  </div>
                )}
                {rest.length > 0 && (
                  <div className="animate-slide-up">
                    {rest.map((item, i) => (
                      <div key={item.id} className="py-6 border-b border-border last:border-0">
                        <NewsCard item={item} featured={i % 2 === 0} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar — inline, scrolls with content */}
          <div className="w-[336px] flex-shrink-0 pt-12">
            <RightSidebar topics={topics} />
          </div>

        </div>
      </div>
    </div>
  )
}
