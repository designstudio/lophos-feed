'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ThumbsDown } from '@untitledui/icons'
import { LophosLogo } from '@/components/LophosLogo'
import { FeedViewSwitcher } from '@/components/FeedViewSwitcher'
import { FeedUpdatesNotice } from '@/components/feed/FeedUpdatesNotice'
import { LikeBurstIcon } from '@/components/LikeBurstIcon'
import { TopicIcon } from '@/components/TopicIcon'
import { NewsSourceAttribution } from '@/components/NewsCard'
import { Tooltip } from '@/components/Tooltip'
import { TopicsDropdown } from '@/components/TopicsDropdown'
import { FeedItem } from '@/lib/types'
import { FEED_CACHE_MAX_ITEMS, FEED_CACHE_VERSION } from '@/lib/feed-pagination-config'
import { cn } from '@/lib/utils'
import { useFeedUpdates } from '@/hooks/useFeedUpdates'
import { useRelevantEditorialLists } from '@/hooks/useRelevantEditorialLists'
import { EditorialListShowcaseCard } from '@/components/editorial/EditorialListShowcaseCard'
import type { EditorialListCardItem } from '@/lib/editorial-list-card'
import { interleaveEditorialLists, type MosaicContentItem } from '@/lib/mixed-feed'

const FEED_CACHE_KEY = 'lophos_feed_cache'
const MOSAIC_SCROLL_KEY = 'lophos_mosaic_feed_scroll'
const FEED_CACHE_TTL = 5 * 60 * 1000
const TOPIC_COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

type MosaicVariant = 'feature' | 'media' | 'text'
type MosaicEntry = MosaicContentItem & { variant: MosaicVariant }
type MosaicBlock = { columns: MosaicEntry[][]; reversed: boolean }
type CachedFeed = {
  items: FeedItem[]
  nextCursor: string | null
  hasMore: boolean
  topics: string[]
  activeFilter: string | null
}

type FeedPageResponse = {
  items: FeedItem[]
  nextCursor: string | null
  hasMore: boolean
  topics: string[]
}

type MosaicScrollState = {
  scrollTop: number
  activeFilter: string | null
}

function toTitleCase(value: string) {
  return value.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function proxyImage(url?: string) {
  return url ? `/api/image-proxy?url=${encodeURIComponent(url)}` : undefined
}

function readCachedFeed(): CachedFeed | null {
  try {
    const serialized = sessionStorage.getItem(FEED_CACHE_KEY)
    if (!serialized) return null
    const cache = JSON.parse(serialized) as {
      version?: number
      timestamp?: number
      items?: FeedItem[]
      nextCursor?: string | null
      hasMore?: boolean
      topics?: string[]
      activeFilter?: string | null
    }
    if (
      cache.version !== FEED_CACHE_VERSION
      || typeof cache.timestamp !== 'number'
      || Date.now() - cache.timestamp > FEED_CACHE_TTL
      || !Array.isArray(cache.items)
      || cache.items.length > FEED_CACHE_MAX_ITEMS
      || (typeof cache.nextCursor !== 'string' && cache.nextCursor !== null)
      || typeof cache.hasMore !== 'boolean'
      || !Array.isArray(cache.topics)
      || (typeof cache.activeFilter !== 'string' && cache.activeFilter !== null)
    ) return null
    return {
      items: cache.items,
      nextCursor: cache.nextCursor,
      hasMore: cache.hasMore,
      topics: cache.topics.filter((topic): topic is string => typeof topic === 'string'),
      activeFilter: cache.activeFilter,
    }
  } catch {
    return null
  }
}

function readMosaicScrollTop(activeFilter: string | null) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(MOSAIC_SCROLL_KEY) || 'null') as Partial<MosaicScrollState> | null
    if (
      saved
      && saved.activeFilter === activeFilter
      && typeof saved.scrollTop === 'number'
      && Number.isFinite(saved.scrollTop)
      && saved.scrollTop >= 0
    ) return saved.scrollTop
  } catch {}
  return 0
}

function writeMosaicScrollTop(scrollTop: number, activeFilter: string | null) {
  try {
    sessionStorage.setItem(MOSAIC_SCROLL_KEY, JSON.stringify({ scrollTop, activeFilter } satisfies MosaicScrollState))
  } catch {}
}

function clearMosaicScrollTop() {
  try {
    sessionStorage.removeItem(MOSAIC_SCROLL_KEY)
  } catch {}
}

function mergeItems(current: FeedItem[], incoming: FeedItem[], prepend = false) {
  const ordered = prepend ? [...incoming, ...current] : [...current, ...incoming]
  const byId = new Map<string, FeedItem>()
  ordered.forEach((item) => {
    if (!byId.has(item.id)) byId.set(item.id, item)
  })
  return Array.from(byId.values()).slice(0, FEED_CACHE_MAX_ITEMS)
}

function asMosaicEntry(content: MosaicContentItem | undefined, variant: MosaicVariant): MosaicEntry | null {
  if (!content) return null
  return { ...content, variant: content.kind === 'editorial-list' && variant === 'text' ? 'media' : variant }
}

function buildMosaicBlocks(items: MosaicContentItem[], deferredStoryIds: Set<string>): MosaicBlock[] {
  const queue = [...items]
  const blocks: MosaicBlock[] = []

  while (queue.length > 0 && blocks.length < Math.ceil(FEED_CACHE_MAX_ITEMS / 3)) {
    const block = queue.splice(0, 5)
    const reversed = blocks.length % 2 === 1

    if (!reversed) {
      blocks.push({
        reversed,
        columns: [
          [asMosaicEntry(block[0], 'feature')].filter(Boolean) as MosaicEntry[],
          [
            asMosaicEntry(block[1], 'text'),
            asMosaicEntry(block[2], 'media'),
          ].filter(Boolean) as MosaicEntry[],
          [
            asMosaicEntry(block[3], 'media'),
            asMosaicEntry(block[4], 'text'),
          ].filter(Boolean) as MosaicEntry[],
        ],
      })
      continue
    }

    const candidates = [block[1], block[3]].filter((content): content is Extract<MosaicContentItem, { kind: 'article' }> => content?.kind === 'article')
    const deferredItem = Array.from(deferredStoryIds)
      .map((id) => candidates.find((content) => content.item.id === id))
      .find((content): content is Extract<MosaicContentItem, { kind: 'article' }> => Boolean(content))
    const deferredId = deferredItem?.item.id
    if (deferredItem) queue.unshift(deferredItem)

    blocks.push({
      reversed,
      columns: [
        [
          asMosaicEntry(block[0], 'media'),
          block[1]?.item.id !== deferredId ? asMosaicEntry(block[1], 'text') : null,
        ].filter(Boolean) as MosaicEntry[],
        [
          asMosaicEntry(block[2], 'text'),
          block[3]?.item.id !== deferredId ? asMosaicEntry(block[3], 'media') : null,
        ].filter(Boolean) as MosaicEntry[],
        [asMosaicEntry(block[4], 'feature')].filter(Boolean) as MosaicEntry[],
      ],
    })
  }

  return blocks
}

function writeMosaicFeedCache(
  items: FeedItem[],
  nextCursor: string | null,
  hasMore: boolean,
  topics: string[],
  activeFilter: string | null,
) {
  if (items.length === 0 || items.length > FEED_CACHE_MAX_ITEMS) return
  try {
    const existing = JSON.parse(sessionStorage.getItem(FEED_CACHE_KEY) || '{}')
    sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({
      ...existing,
      version: FEED_CACHE_VERSION,
      timestamp: Date.now(),
      items,
      nextCursor,
      hasMore,
      topics,
      activeFilter,
      scrollTop: typeof existing.scrollTop === 'number' ? existing.scrollTop : 0,
    }))
  } catch {}
}

async function requestFeedPage(topic: string | null, cursor: string | null, signal: AbortSignal): Promise<FeedPageResponse> {
  const response = await fetch('/api/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics: topic ? [topic] : [], ...(cursor ? { cursor } : {}) }),
    signal,
  })
  if (!response.ok || !response.body) throw new Error('Não foi possível carregar o feed.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const result: FeedPageResponse = { items: [], nextCursor: null, hasMore: false, topics: [] }
  let buffer = ''

  const consume = (line: string) => {
    if (!line.trim()) return
    const chunk = JSON.parse(line)
    if (chunk.error) throw new Error(chunk.error === 'No topics' ? 'Nenhum tópico salvo.' : chunk.error)
    if (Array.isArray(chunk.topics)) result.topics = chunk.topics
    if (Array.isArray(chunk.items)) result.items.push(...chunk.items)
    if (typeof chunk.hasMore === 'boolean') result.hasMore = chunk.hasMore
    if (typeof chunk.nextCursor === 'string' || chunk.nextCursor === null) result.nextCursor = chunk.nextCursor
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    lines.forEach(consume)
  }
  buffer += decoder.decode()
  consume(buffer)
  return result
}

function capitalizeFirst(value: string) {
  const trimmed = value.trim()
  return trimmed ? `${trimmed.charAt(0).toLocaleUpperCase('pt-BR')}${trimmed.slice(1)}` : trimmed
}

function MosaicStory({
  item,
  variant,
  initialReaction,
  onReactionChange,
  animationIndex,
}: {
  item: FeedItem
  variant: MosaicVariant
  initialReaction: 'like' | 'dislike' | null
  onReactionChange: (articleId: string, reaction: 'like' | 'dislike' | null) => void
  animationIndex: number
}) {
  const image = proxyImage(item.imageUrl || item.coverageImages?.[0])
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(image) && !imageFailed
  const showImage = variant !== 'text' && hasImage
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(initialReaction)
  const [reacting, setReacting] = useState(false)
  const [likeBurstToken, setLikeBurstToken] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => setReaction(initialReaction), [initialReaction])
  useEffect(() => setImageFailed(false), [image])

  const react = async (type: 'like' | 'dislike') => {
    if (reacting) return
    const previous = reaction
    const next = reaction === type ? null : type
    setReacting(true)
    if (type === 'like' && next === 'like') setLikeBurstToken((token) => token + 1)
    setReaction(next)
    onReactionChange(item.id, next)

    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: item.id, topic: item.topic, reaction: next }),
      })
    } catch {
      setReaction(previous)
      onReactionChange(item.id, previous)
    } finally {
      setReacting(false)
    }
  }

  const storyFooter = (
    <div className="mosaic-story__footer">
      <NewsSourceAttribution sources={item.sources} />
      <div className="editorial-card__reactions">
        <Tooltip content={reaction === 'like' ? 'Descurtir' : 'Curtir'} side="top">
          <motion.button
            type="button"
            onClick={() => { void react('like') }}
            whileTap={{ scale: 0.85 }}
            disabled={reacting}
            className={cn('editorial-card__reaction editorial-card__reaction--like', reaction === 'like' && 'is-active')}
            aria-label={reaction === 'like' ? 'Descurtir' : 'Curtir'}
            aria-pressed={reaction === 'like'}
          >
            <LikeBurstIcon liked={reaction === 'like'} burstToken={likeBurstToken} size={20} />
          </motion.button>
        </Tooltip>

        <Tooltip content="Não tenho interesse" side="top">
          <motion.button
            type="button"
            onClick={() => { void react('dislike') }}
            whileTap={{ scale: 0.85 }}
            disabled={reacting}
            className={cn('editorial-card__reaction editorial-card__reaction--dislike', reaction === 'dislike' && 'is-active')}
            aria-label="Não tenho interesse"
            aria-pressed={reaction === 'dislike'}
          >
            <ThumbsDown size={20} />
          </motion.button>
        </Tooltip>
      </div>
    </div>
  )

  return (
    <motion.article
      className={cn('mosaic-story', `mosaic-story--${variant}`)}
      data-story-id={item.id}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: reduceMotion ? 0 : animationIndex * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="category-topic-pill mosaic-story__category">
        <TopicIcon topic={item.displayTopic || item.topic} fallbackTopic={item.topic} />
        <span>{capitalizeFirst(item.displayTopic || item.topic)}</span>
      </div>
      <Link
        href={`/article/${item.id}`}
        prefetch={false}
        className="mosaic-story__link"
      >
        {variant === 'feature' && <h2>{item.title}</h2>}
        {showImage && (
          <div className="mosaic-story__image">
            <img src={image} alt="" onError={() => setImageFailed(true)} />
          </div>
        )}
        {variant !== 'feature' && <h2>{item.title}</h2>}
        {variant === 'feature' && <p>{item.summary}</p>}
      </Link>
      {storyFooter}
    </motion.article>
  )
}

export function MosaicArticleGrid({
  items,
  reactions,
  onReactionChange,
  deferredStoryIds = new Set<string>(),
  editorialLists = [],
  listReactions = {},
  onListReactionChange,
  contentItems,
}: {
  items: FeedItem[]
  reactions: Record<string, 'like' | 'dislike'>
  onReactionChange: (articleId: string, reaction: 'like' | 'dislike' | null) => void
  deferredStoryIds?: Set<string>
  editorialLists?: EditorialListCardItem[]
  listReactions?: Record<string, 'like' | 'dislike'>
  onListReactionChange?: (id: string, reaction: 'like' | 'dislike' | null) => void
  contentItems?: MosaicContentItem[]
}) {
  const blocks = buildMosaicBlocks(contentItems ?? interleaveEditorialLists(items, editorialLists), deferredStoryIds)

  return (
    <div className="mosaic-feed-blocks">
      {blocks.map(({ columns, reversed }, blockIndex) => (
        <div
          className={cn('mosaic-feed-grid', reversed && 'mosaic-feed-grid--reversed')}
          key={columns.flat()[0]?.item.id || blockIndex}
        >
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="mosaic-feed-column">
              {column.map((entry, storyIndex) => entry.kind === 'article' ? (
                <MosaicStory
                  key={entry.item.id}
                  item={entry.item}
                  variant={entry.variant}
                  initialReaction={reactions[entry.item.id] ?? null}
                  onReactionChange={onReactionChange}
                  animationIndex={columnIndex * 2 + storyIndex}
                />
              ) : (
                <EditorialListShowcaseCard
                  key={`list-${entry.item.id}`}
                  list={entry.item}
                  variant={entry.variant === 'feature' ? 'feature' : 'media'}
                  animationIndex={columnIndex * 2 + storyIndex}
                  label="editorial-list"
                  initialReaction={listReactions[entry.item.id] ?? null}
                  onReactionChange={onListReactionChange}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function MosaicSkeleton() {
  return (
    <div
      className="mosaic-feed-grid mosaic-feed-grid--skeleton"
      aria-label="Carregando feed"
      aria-busy="true"
    >
      {[0, 1, 2].map((column) => (
        <div key={column} className="mosaic-feed-column">
          {Array.from({ length: column === 0 ? 1 : 2 }, (_, item) => (
            <div key={item} className="mosaic-story mosaic-story--skeleton">
              <span className="skeleton h-5 w-32 rounded-full" />
              <span className="skeleton h-7 w-full rounded-lg" />
              {(column + item) % 2 === 0 && <span className="skeleton aspect-[16/10] w-full rounded-[1.25rem]" />}
              <span className="skeleton h-4 w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function MosaicFeedView() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoadAttempt, setInitialLoadAttempt] = useState(0)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [paginationSentinel, setPaginationSentinel] = useState<HTMLDivElement | null>(null)
  const [topics, setTopics] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const editorialLists = useRelevantEditorialLists(activeFilter)
  const [deferredStoryIds, setDeferredStoryIds] = useState<Set<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const paginationAbortRef = useRef<AbortController | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const activeFilterRef = useRef<string | null>(null)
  const scrollTopRef = useRef(0)
  const restoredScrollTopRef = useRef<number | null>(null)
  const scrollSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigatingToArticleRef = useRef(false)
  const restoringScrollRef = useRef(false)

  useEffect(() => {
    const cached = readCachedFeed()
    if (cached && cached.items.length > 0) {
      setItems(cached.items)
      setNextCursor(cached.nextCursor)
      nextCursorRef.current = cached.nextCursor
      setHasMore(cached.hasMore)
      hasMoreRef.current = cached.hasMore
      setTopics(cached.topics)
      setActiveFilter(cached.activeFilter)
      activeFilterRef.current = cached.activeFilter
      const cachedScrollTop = readMosaicScrollTop(cached.activeFilter)
      restoredScrollTopRef.current = cachedScrollTop
      restoringScrollRef.current = cachedScrollTop > 0
      setLoading(false)
      return
    }

    clearMosaicScrollTop()

    const controller = new AbortController()

    const loadFeed = async () => {
      try {
        let page: FeedPageResponse
        try {
          page = await requestFeedPage(null, null, controller.signal)
        } catch (firstError) {
          if ((firstError as Error).name === 'AbortError') throw firstError
          await new Promise((resolve) => window.setTimeout(resolve, 450))
          page = await requestFeedPage(null, null, controller.signal)
        }
        setItems(page.items)
        setTopics(page.topics)
        setNextCursor(page.nextCursor)
        nextCursorRef.current = page.nextCursor
        const canLoadMore = page.hasMore && page.items.length < FEED_CACHE_MAX_ITEMS
        setHasMore(canLoadMore)
        hasMoreRef.current = canLoadMore
      } catch (caught) {
        if ((caught as Error).name !== 'AbortError') {
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o feed.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadFeed()
    return () => {
      controller.abort()
      paginationAbortRef.current?.abort()
    }
  }, [initialLoadAttempt])

  const loadNextPage = useCallback(async () => {
    if (
      loadingMoreRef.current
      || !hasMoreRef.current
      || !nextCursorRef.current
      || items.length >= FEED_CACHE_MAX_ITEMS
    ) return

    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    const controller = new AbortController()
    paginationAbortRef.current = controller

    try {
      let cursor: string | null = nextCursorRef.current
      let page: FeedPageResponse | null = null
      for (let attempt = 0; attempt < 3 && cursor; attempt += 1) {
        page = await requestFeedPage(activeFilter, cursor, controller.signal)
        cursor = page.nextCursor
        if (page.items.length > 0 || !page.hasMore) break
      }
      if (!page) return

      const merged = mergeItems(items, page.items)
      const reachedLimit = merged.length >= FEED_CACHE_MAX_ITEMS
      setItems(merged)
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      const canLoadMore = page.hasMore && !reachedLimit
      setHasMore(canLoadMore)
      hasMoreRef.current = canLoadMore
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') {
        setLoadMoreError(caught instanceof Error ? caught.message : 'Não foi possível carregar mais notícias.')
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [activeFilter, items])

  useEffect(() => {
    if (items.length === 0) return
    writeMosaicFeedCache(items, nextCursor, hasMore, topics, activeFilter)
  }, [activeFilter, hasMore, items, nextCursor, topics])

  useEffect(() => {
    if (loading || items.length === 0 || restoredScrollTopRef.current === null || !scrollRef.current) return
    const targetScrollTop = restoredScrollTopRef.current
    const applyScrollPosition = () => {
      if (!scrollRef.current) return
      scrollRef.current.scrollTop = targetScrollTop
      scrollTopRef.current = targetScrollTop
    }
    const frame = requestAnimationFrame(applyScrollPosition)
    const settleTimeout = setTimeout(() => {
      applyScrollPosition()
      restoredScrollTopRef.current = null
      restoringScrollRef.current = false
    }, 250)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimeout)
    }
  }, [items.length, loading])

  useEffect(() => {
    navigatingToArticleRef.current = false
    return () => {
      if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
      if (!navigatingToArticleRef.current && !restoringScrollRef.current) {
        writeMosaicScrollTop(scrollTopRef.current, activeFilterRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!paginationSentinel || !hasMore || loadingMore || loadMoreError) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) void loadNextPage() },
      { root: scrollRef.current, rootMargin: '1600px 0px', threshold: 0.01 },
    )
    observer.observe(paginationSentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMoreError, loadingMore, loadNextPage, paginationSentinel])

  const selectTopic = useCallback(async (topic: string | null) => {
    if (activeFilter === topic) return
    paginationAbortRef.current?.abort()
    const controller = new AbortController()
    paginationAbortRef.current = controller
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    sessionStorage.removeItem(FEED_CACHE_KEY)
    clearMosaicScrollTop()
    scrollTopRef.current = 0
    setActiveFilter(topic)
    activeFilterRef.current = topic
    setDeferredStoryIds(new Set())
    setItems([])
    setLoading(true)
    setError(null)
    setLoadMoreError(null)
    setNextCursor(null)
    nextCursorRef.current = null
    setHasMore(false)
    hasMoreRef.current = false

    try {
      const page = await requestFeedPage(topic, null, controller.signal)
      setItems(page.items)
      if (page.topics.length > 0 && topic === null) setTopics(page.topics)
      setNextCursor(page.nextCursor)
      nextCursorRef.current = page.nextCursor
      const canLoadMore = page.hasMore && page.items.length < FEED_CACHE_MAX_ITEMS
      setHasMore(canLoadMore)
      hasMoreRef.current = canLoadMore
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') {
        setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o feed.')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => {
    fetch('/api/reactions')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.reactions) setReactions(data.reactions) })
      .catch(() => undefined)
  }, [])

  const handleReactionChange = (articleId: string, reaction: 'like' | 'dislike' | null) => {
    setReactions((current) => {
      const next = { ...current }
      if (reaction) next[articleId] = reaction
      else delete next[articleId]
      return next
    })
  }

  const applyFeedUpdates = useCallback((newItems: FeedItem[]) => {
    setItems((current) => mergeItems(current, newItems, true))
    setDeferredStoryIds(new Set())
    clearMosaicScrollTop()
    scrollTopRef.current = 0
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useFeedUpdates({
    items,
    topics: activeFilter ? [activeFilter] : topics,
    onApplyUpdates: applyFeedUpdates,
  })

  const visibleItems = items.filter((item) => reactions[item.id] !== 'dislike')
  const filterTopics = [...new Set(topics.map(toTitleCase))].sort(TOPIC_COLLATOR.compare)
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let frame = 0

    const measureOverflow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (window.innerWidth < 1024) return
        const overflowIds: string[] = []

        root.querySelectorAll<HTMLElement>('.mosaic-feed-grid--reversed').forEach((grid) => {
          const columns = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .mosaic-feed-column'))
          const featuredColumn = columns[2]
          if (!featuredColumn || featuredColumn.querySelectorAll(':scope > .mosaic-story').length !== 1) return
          const featuredHeight = featuredColumn.getBoundingClientRect().height
          if (columns.slice(0, 2).some((column) => column.querySelectorAll(':scope > .mosaic-story').length !== 2)) return

          const candidates = columns.slice(0, 2).map((column) => {
            const stories = Array.from(column.querySelectorAll<HTMLElement>(':scope > .mosaic-story'))
            return {
              storyId: stories.at(-1)?.dataset.storyId,
              overflow: column.getBoundingClientRect().height - featuredHeight,
            }
          }).filter((candidate) => candidate.storyId && candidate.overflow > 120)

          candidates.sort((first, second) => second.overflow - first.overflow)
          if (candidates[0]?.storyId) overflowIds.push(candidates[0].storyId)
        })

        if (overflowIds.length === 0) return
        setDeferredStoryIds((current) => {
          const next = new Set(current)
          overflowIds.forEach((id) => next.add(id))
          return next.size === current.size ? current : next
        })
      })
    }

    const observer = new ResizeObserver(measureOverflow)
    root.querySelectorAll<HTMLElement>('.mosaic-feed-grid--reversed').forEach((grid) => observer.observe(grid))
    window.addEventListener('resize', measureOverflow)
    measureOverflow()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measureOverflow)
    }
  }, [activeFilter, deferredStoryIds.size, visibleItems.length])

  return (
    <div
      ref={scrollRef}
      className="mosaic-feed-scroll"
      onClickCapture={(event) => {
        const target = event.target as Element
        if (!target.closest('a[href^="/article/"]')) return
        navigatingToArticleRef.current = true
        if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
        scrollSaveTimeoutRef.current = null
        const currentScrollTop = event.currentTarget.scrollTop
        scrollTopRef.current = currentScrollTop
        writeMosaicScrollTop(currentScrollTop, activeFilterRef.current)
      }}
      onScroll={(event) => {
        if (navigatingToArticleRef.current || restoringScrollRef.current) return
        const container = event.currentTarget
        scrollTopRef.current = container.scrollTop
        if (scrollSaveTimeoutRef.current) clearTimeout(scrollSaveTimeoutRef.current)
        scrollSaveTimeoutRef.current = setTimeout(() => {
          writeMosaicScrollTop(scrollTopRef.current, activeFilterRef.current)
          scrollSaveTimeoutRef.current = null
        }, 150)
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
        if (remaining <= container.clientHeight * 2) void loadNextPage()
      }}
    >
      <header className="feed-view-header">
        <div className="feed-view-header__filters">
          <LophosLogo size={30} className="md:hidden" />
          <div className="editorial-feed-controls" aria-label="Filtros do feed">
            <button
              type="button"
              onClick={() => { void selectTopic(null) }}
              className={cn('editorial-filter', activeFilter === null && 'is-active')}
            >
              Recentes
            </button>
            <TopicsDropdown topics={filterTopics} activeFilter={activeFilter} onSelect={selectTopic} />
            <FeedUpdatesNotice />
          </div>
        </div>
        <FeedViewSwitcher current="mosaic" />
      </header>

      <main className="mosaic-feed-page">
        {error && items.length === 0 && !loading ? (
          <motion.div
            className="mosaic-feed-message"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setLoading(true)
                setInitialLoadAttempt((current) => current + 1)
              }}
            >
              Tentar novamente
            </button>
          </motion.div>
        ) : (
          <div
            key={activeFilter ?? 'recentes'}
            className={cn(
              't-skel t-skel--flow',
              loading && items.length === 0 && 'is-resetting',
              items.length > 0 && 'is-revealed',
            )}
            data-state={loading && items.length === 0 ? 'loading' : 'loaded'}
            aria-busy={loading && items.length === 0}
          >
            <div
              className="t-skel-skeleton is-pulsing"
              aria-hidden={items.length > 0}
            >
              <MosaicSkeleton />
            </div>

            <div
              className="t-skel-content"
              aria-hidden={items.length === 0}
              inert={items.length === 0}
            >
              <div>
                <MosaicArticleGrid
                  items={visibleItems}
                  reactions={reactions}
                  onReactionChange={handleReactionChange}
                  deferredStoryIds={deferredStoryIds}
                  editorialLists={editorialLists.items}
                  listReactions={editorialLists.reactions}
                  onListReactionChange={editorialLists.onReactionChange}
                />
                {hasMore && !loadMoreError && (
                  <div
                    ref={setPaginationSentinel}
                    className="mosaic-feed-pagination-skeleton"
                    aria-live="polite"
                    aria-busy={loadingMore}
                    aria-label="Carregando mais notícias"
                  >
                    {[0, 1, 2].map((item) => (
                      <div className="mosaic-feed-pagination-card" key={item}>
                        <span className="skeleton h-5 w-24 rounded-full" />
                        <span className="skeleton h-7 w-full rounded-lg" />
                        <span className="skeleton h-4 w-2/3 rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
                {loadMoreError && (
                  <div className="mosaic-feed-load-error" role="status">
                    <button type="button" onClick={() => { void loadNextPage() }}>
                      Não foi possível carregar mais notícias. Tentar novamente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
