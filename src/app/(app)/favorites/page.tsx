'use client'
import { useCallback, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Heart as HeartAngle } from '@untitledui/icons'
import { FeedViewSwitcher, usePreferredFeedView } from '@/components/FeedViewSwitcher'
import { MosaicArticleGrid, MosaicSkeleton } from '@/components/feed/MosaicFeedView'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'

type FavoritesPageResponse = {
  items: NewsItem[]
  hasMore: boolean
  nextOffset: number | null
}

async function requestFavoritesPage(offset: number, signal?: AbortSignal): Promise<FavoritesPageResponse> {
  const response = await fetch(`/api/favorites/articles?offset=${offset}`, { signal })
  if (!response.ok) throw new Error('Não foi possível carregar suas curtidas.')
  return response.json()
}

function splitIntoBlocks(items: NewsItem[]): { items: NewsItem[] }[] {
  return items.map((item) => ({ items: [item] }))
}

function FeedBlock({ items, reactions, onReactionChange }: {
  items: NewsItem[]
  reactions: Record<string, 'like' | 'dislike'>
  onReactionChange: (id: string, r: 'like' | 'dislike' | null) => void
}) {
  return (
    <div className="editorial-card-stack">
      {items.map(item => <NewsCard key={item.id} item={item} initialReaction={reactions[item.id] ?? null} onReactionChange={onReactionChange} />)}
    </div>
  )
}

export default function FavoritesPage() {
  const view = usePreferredFeedView()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    requestFavoritesPage(0, controller.signal)
      .then((data) => {
        setItems(data.items)
        setReactions(Object.fromEntries(data.items.map((item) => [item.id, 'like' as const])))
        setHasMore(data.hasMore)
        setNextOffset(data.nextOffset)
      })
      .catch((caught) => {
        if ((caught as Error).name !== 'AbortError') {
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar suas curtidas.')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [loadAttempt])

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || nextOffset === null) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)

    try {
      const data = await requestFavoritesPage(nextOffset)
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        data.items.forEach((item) => byId.set(item.id, item))
        return Array.from(byId.values())
      })
      setReactions((current) => ({
        ...current,
        ...Object.fromEntries(data.items.map((item) => [item.id, 'like' as const])),
      }))
      setHasMore(data.hasMore)
      setNextOffset(data.nextOffset)
    } catch (caught) {
      setLoadMoreError(caught instanceof Error ? caught.message : 'Não foi possível carregar mais curtidas.')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [nextOffset])

  const handleReactionChange = (id: string, r: 'like' | 'dislike' | null) => {
    setReactions(prev => {
      const next = { ...prev }
      if (r === null) delete next[id]
      else next[id] = r
      return next
    })
    // Optimistic UI: remove da lista imediatamente ao descurtir
    if (r !== 'like') {
      setItems(prev => prev.filter(item => item.id !== id))
      setNextOffset((current) => current === null ? null : Math.max(0, current - 1))
    }
  }

  // Filtra para mostrar apenas artigos ainda curtidos
  const likedItems = items.filter(item => reactions[item.id] !== 'dislike')
  const allBlocks = splitIntoBlocks(likedItems)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loadingMore || loadMoreError) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) void loadNextPage() },
      { root: scrollRef.current, rootMargin: '1600px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, loadingMore, loadMoreError, loadNextPage, view])

  return (
    <div
      ref={scrollRef}
      className="editorial-page-scroll"
      onScroll={(event) => {
        const container = event.currentTarget
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
        if (hasMore && remaining <= container.clientHeight * 2) void loadNextPage()
      }}
    >
      <header className="favorites-view-header">
        <div className="favorites-view-header__title">
          <h1>Minhas curtidas</h1>
        </div>
        <FeedViewSwitcher current={view} ariaLabel="Visualização das curtidas" />
      </header>

      <main className={view === 'mosaic' ? 'mosaic-feed-page' : 'editorial-feed-layout'}>
        <div className="pb-24 md:pb-10">

          {loading && (
            view === 'mosaic' ? <MosaicSkeleton /> : (
              <div className="editorial-card-stack">
                <SkeletonBlock /><SkeletonBlock />
              </div>
            )
          )}

          {!loading && error && likedItems.length === 0 && (
            <div className="mosaic-feed-message" role="status">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setLoadAttempt((current) => current + 1)
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && likedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <HeartAngle size={40} className="text-ink-tertiary opacity-40" />
              <div>
                <p className="text-[15px] font-medium text-ink-secondary">Nenhuma curtida ainda</p>
                <p className="text-[13px] text-ink-tertiary mt-1">Curta artigos clicando no coração enquanto lê o feed.</p>
              </div>
              <Link href="/feed"
                className="mt-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-80 transition-opacity"
                style={{ background: 'var(--color-ui-strong)' }}>
                Ver meu feed
              </Link>
            </div>
          )}

          {!loading && likedItems.length > 0 && view === 'list' && (
            <div className="editorial-card-stack">
              {allBlocks.map((block) => (
                <FeedBlock key={block.items[0].id} items={block.items} reactions={reactions} onReactionChange={handleReactionChange} />
              ))}
              {hasMore && !loadMoreError && (
                <div ref={sentinelRef} aria-live="polite" aria-busy={loadingMore}>
                  {loadingMore && <SkeletonBlock />}
                </div>
              )}
            </div>
          )}

          {!loading && likedItems.length > 0 && view === 'mosaic' && (
            <>
              <MosaicArticleGrid
                items={likedItems}
                reactions={reactions}
                onReactionChange={handleReactionChange}
              />
              {hasMore && !loadMoreError && (
                <div ref={sentinelRef} aria-live="polite" aria-busy={loadingMore}>
                  {loadingMore && (
                    <div className="mosaic-feed-pagination-skeleton" aria-label="Carregando mais curtidas">
                      {[0, 1, 2].map((item) => (
                        <div className="mosaic-feed-pagination-card" key={item}>
                          <span className="skeleton h-5 w-24 rounded-full" />
                          <span className="skeleton h-7 w-full rounded-lg" />
                          <span className="skeleton h-4 w-2/3 rounded-full" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!loading && loadMoreError && (
            <div className="mosaic-feed-load-error" role="status">
              <button type="button" onClick={() => { void loadNextPage() }}>
                {loadMoreError} Tentar novamente
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
