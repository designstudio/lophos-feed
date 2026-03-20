'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { Rss } from 'lucide-react'

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes

export default function FeedPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [topics, setTopics] = useState<string[]>([])
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [hasTopics, setHasTopics] = useState(true)

  // Load user topics from DB
  useEffect(() => {
    if (!isLoaded || !user) return
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => {
        const userTopics = (data.topics || []).map((t: any) => t.topic)
        if (userTopics.length === 0) {
          setHasTopics(false)
          router.push('/onboarding')
          return
        }
        setTopics(userTopics)
      })
  }, [isLoaded, user, router])

  // Fetch feed whenever topics load
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
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topics])

  useEffect(() => {
    if (topics.length > 0) fetchFeed()
  }, [topics, fetchFeed])

  // Auto-refresh every 30 minutes
  useEffect(() => {
    if (topics.length === 0) return
    const interval = setInterval(() => fetchFeed(true), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [topics, fetchFeed])

  const filteredItems = activeFilter
    ? items.filter((i) => i.topic === activeFilter)
    : items

  const topicsInFeed = [...new Set(items.map((i) => i.topic))]

  const featured = filteredItems[0]
  const secondary = filteredItems.slice(1, 4)
  const rest = filteredItems.slice(4)

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar onRefresh={() => fetchFeed(true)} refreshing={refreshing} />

      <main className="flex-1 min-w-0 max-w-4xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl text-ink-primary">Descobrir</h1>
          </div>
          {/* Topic filter tabs */}
          {topicsInFeed.length > 1 && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => setActiveFilter(null)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
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
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
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
            <div className="pb-8 border-b border-border">
              <SkeletonCard featured />
            </div>
            <div className="grid grid-cols-3 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="space-y-6">
              <SkeletonCard featured />
              <SkeletonCard featured />
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Rss size={32} className="text-ink-muted mb-4" />
            <p className="text-ink-secondary">Nenhuma notícia encontrada.</p>
            <button
              onClick={() => fetchFeed(true)}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Feed */}
        {!loading && filteredItems.length > 0 && (
          <div className="space-y-0 stagger">
            {/* Featured article */}
            {featured && (
              <div className="pb-8 border-b border-border animate-slide-up">
                <NewsCard item={featured} featured />
              </div>
            )}

            {/* 3-column secondary grid */}
            {secondary.length > 0 && (
              <div className="grid grid-cols-3 gap-6 py-8 border-b border-border animate-slide-up">
                {secondary.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Rest as featured rows */}
            {rest.length > 0 && (
              <div className="space-y-0 animate-slide-up">
                {rest.map((item, i) => (
                  <div key={item.id} className="py-7 border-b border-border last:border-0">
                    <NewsCard item={item} featured={i % 2 === 0} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
