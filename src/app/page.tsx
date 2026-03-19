'use client'
import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { Sparkles, Rss } from 'lucide-react'

const DEFAULT_TOPICS = ['Inteligência Artificial', 'Formula 1', 'Cinema']
const STORAGE_KEY = 'myfeed_topics'

export default function FeedPage() {
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS)
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // Load topics from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setTopics(JSON.parse(saved)) } catch {}
    }
  }, [])

  const handleTopicsChange = (newTopics: string[]) => {
    setTopics(newTopics)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTopics))
  }

  const fetchFeed = useCallback(async () => {
    if (topics.length === 0) return
    setLoading(true)
    setError(null)
    setActiveFilter(null)

    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar notícias')
      setItems(data.items || [])
      setHasLoaded(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [topics])

  const filteredItems = activeFilter
    ? items.filter((i) => i.topic === activeFilter)
    : items

  const topicsWithNews = [...new Set(items.map((i) => i.topic))]

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-10">

        {/* Sidebar */}
        <Sidebar
          topics={topics}
          onTopicsChange={handleTopicsChange}
          onRefresh={fetchFeed}
          loading={loading}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* Header */}
          <div className="mb-6">
            <h1 className="font-display text-3xl text-text-primary mb-1">
              Seu feed
            </h1>
            <p className="text-text-tertiary text-sm">
              {hasLoaded
                ? `${items.length} notícias de ${topics.length} tópico${topics.length !== 1 ? 's' : ''}`
                : 'Adicione tópicos e atualize o feed.'}
            </p>
          </div>

          {/* Topic filter tabs */}
          {hasLoaded && topicsWithNews.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              <button
                onClick={() => setActiveFilter(null)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  activeFilter === null
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border-subtle text-text-tertiary hover:text-text-secondary'
                }`}
              >
                Todos
              </button>
              {topicsWithNews.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveFilter(activeFilter === t ? null : t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    activeFilter === t
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-subtle text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="grid gap-4">
              {Array.from({ length: topics.length * 2 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Empty — not yet loaded */}
          {!loading && !hasLoaded && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center mb-4">
                <Rss size={24} className="text-text-tertiary" />
              </div>
              <p className="text-text-secondary text-base mb-1">Feed vazio</p>
              <p className="text-text-tertiary text-sm max-w-xs">
                Adicione tópicos na barra lateral e clique em <strong className="text-text-secondary">Atualizar feed</strong> para começar.
              </p>
            </div>
          )}

          {/* News grid */}
          {!loading && filteredItems.length > 0 && (
            <div className="grid gap-4 stagger">
              {filteredItems.map((item, i) => (
                <NewsCard
                  key={`${item.topic}-${i}`}
                  item={item}
                  style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}
                />
              ))}
            </div>
          )}

          {/* No results for filter */}
          {!loading && hasLoaded && filteredItems.length === 0 && activeFilter && (
            <div className="text-center py-12 text-text-tertiary text-sm">
              Nenhuma notícia para "{activeFilter}"
            </div>
          )}

          {/* Footer */}
          {hasLoaded && !loading && (
            <div className="mt-8 flex items-center gap-2 text-text-tertiary text-xs">
              <Sparkles size={12} />
              <span>Curado por Gemini + Google Search</span>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
