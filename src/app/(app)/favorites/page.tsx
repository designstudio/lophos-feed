'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart as HeartAngle } from '@untitledui/icons'
import { FeedViewSwitcher, usePreferredFeedView } from '@/components/FeedViewSwitcher'
import { MosaicArticleGrid, MosaicSkeleton } from '@/components/feed/MosaicFeedView'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { EditorialListShowcaseCard } from '@/components/editorial/EditorialListShowcaseCard'
import type { NewsItem } from '@/lib/types'
import type { EditorialListCardItem } from '@/lib/editorial-list-card'
import type { MosaicContentItem } from '@/lib/mixed-feed'

type FavoriteEntry =
  | { kind: 'article'; item: NewsItem }
  | { kind: 'editorial-list'; list: EditorialListCardItem }

type FavoritesPageResponse = { items: FavoriteEntry[]; hasMore: boolean; nextOffset: number | null }

async function requestFavoritesPage(offset: number, signal?: AbortSignal): Promise<FavoritesPageResponse> {
  const response = await fetch(`/api/favorites/articles?offset=${offset}`, { signal })
  if (!response.ok) throw new Error('Não foi possível carregar suas curtidas.')
  return response.json()
}

function entryKey(entry: FavoriteEntry) {
  return entry.kind === 'article' ? `article-${entry.item.id}` : `list-${entry.list.id}`
}

export default function FavoritesPage() {
  const view = usePreferredFeedView()
  const [entries, setEntries] = useState<FavoriteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [articleReactions, setArticleReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [listReactions, setListReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const applyPage = useCallback((data: FavoritesPageResponse, append: boolean) => {
    setEntries((current) => {
      if (!append) return data.items
      const merged = new Map(current.map((entry) => [entryKey(entry), entry]))
      data.items.forEach((entry) => merged.set(entryKey(entry), entry))
      return Array.from(merged.values())
    })
    setArticleReactions((current) => ({ ...current, ...Object.fromEntries(data.items.flatMap((entry) => entry.kind === 'article' ? [[entry.item.id, 'like' as const]] : [])) }))
    setListReactions((current) => ({ ...current, ...Object.fromEntries(data.items.flatMap((entry) => entry.kind === 'editorial-list' ? [[entry.list.id, 'like' as const]] : [])) }))
    setHasMore(data.hasMore)
    setNextOffset(data.nextOffset)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    requestFavoritesPage(0, controller.signal)
      .then((data) => applyPage(data, false))
      .catch((caught) => { if ((caught as Error).name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'Não foi possível carregar suas curtidas.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [applyPage, loadAttempt])

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || nextOffset === null) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      applyPage(await requestFavoritesPage(nextOffset), true)
    } catch (caught) {
      setLoadMoreError(caught instanceof Error ? caught.message : 'Não foi possível carregar mais curtidas.')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [applyPage, nextOffset])

  useEffect(() => {
    const element = sentinelRef.current
    if (!element || !hasMore || loadingMore || loadMoreError) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadNextPage() }, { root: scrollRef.current, rootMargin: '1600px 0px', threshold: 0.01 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMore, loadMoreError, loadingMore, loadNextPage, view])

  const removeArticle = (id: string, reaction: 'like' | 'dislike' | null) => {
    if (reaction !== 'like') setEntries((current) => current.filter((entry) => entry.kind !== 'article' || entry.item.id !== id))
  }
  const removeList = (id: string, reaction: 'like' | 'dislike' | null) => {
    if (reaction !== 'like') setEntries((current) => current.filter((entry) => entry.kind !== 'editorial-list' || entry.list.id !== id))
  }
  const mosaicItems: MosaicContentItem[] = entries.map((entry) => entry.kind === 'article'
    ? { kind: 'article', item: entry.item }
    : { kind: 'editorial-list', item: entry.list })

  return (
    <div ref={scrollRef} className="editorial-page-scroll" onScroll={(event) => {
      const container = event.currentTarget
      if (hasMore && container.scrollHeight - container.scrollTop - container.clientHeight <= container.clientHeight * 2) void loadNextPage()
    }}>
      <header className="favorites-view-header">
        <div className="favorites-view-header__title"><h1>Minhas curtidas</h1></div>
        <FeedViewSwitcher current={view} ariaLabel="Visualização das curtidas" />
      </header>
      <main className={view === 'mosaic' ? 'mosaic-feed-page' : 'editorial-feed-layout'}>
        <div className="pb-24 md:pb-10">
          {loading && (view === 'mosaic' ? <MosaicSkeleton /> : <div className="editorial-card-stack"><SkeletonBlock /><SkeletonBlock /></div>)}
          {!loading && error && entries.length === 0 && <div className="mosaic-feed-message" role="status"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setLoadAttempt((value) => value + 1) }}>Tentar novamente</button></div>}
          {!loading && !error && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <HeartAngle size={40} className="text-ink-tertiary opacity-40" />
              <div><p className="text-[15px] font-medium text-ink-secondary">Nenhuma curtida ainda</p><p className="text-[13px] text-ink-tertiary mt-1">Curta artigos e listas editoriais enquanto explora o Lophos.</p></div>
              <Link href="/feed" className="mt-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-80 transition-opacity" style={{ background: 'var(--color-ui-strong)' }}>Ver meu feed</Link>
            </div>
          )}
          {!loading && entries.length > 0 && view === 'list' && (
            <div className="editorial-card-stack">
              {entries.map((entry, index) => entry.kind === 'article' ? (
                <NewsCard key={entryKey(entry)} item={entry.item} initialReaction="like" onReactionChange={removeArticle} />
              ) : (
                <EditorialListShowcaseCard key={entryKey(entry)} list={entry.list} animationIndex={index} variant="feature" label="editorial-list" initialReaction="like" onReactionChange={removeList} />
              ))}
            </div>
          )}
          {!loading && entries.length > 0 && view === 'mosaic' && (
            <MosaicArticleGrid items={[]} contentItems={mosaicItems} reactions={articleReactions} onReactionChange={removeArticle} listReactions={listReactions} onListReactionChange={removeList} />
          )}
          {hasMore && !loadMoreError && <div ref={sentinelRef} aria-live="polite" aria-busy={loadingMore}>{loadingMore && <SkeletonBlock />}</div>}
          {!loading && loadMoreError && <div className="mosaic-feed-load-error" role="status"><button type="button" onClick={() => { void loadNextPage() }}>{loadMoreError} Tentar novamente</button></div>}
        </div>
      </main>
    </div>
  )
}
