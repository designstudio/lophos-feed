'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bookmark } from '@solar-icons/react-perf/Linear'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

function splitIntoBlocks(items: NewsItem[]): { items: NewsItem[] }[] {
  const blocks: { items: NewsItem[] }[] = []
  let i = 0
  while (i < items.length) {
    const pos = blocks.length % 3
    if (pos === 1) {
      const count = Math.min(3, items.length - i)
      blocks.push({ items: items.slice(i, i + count) })
      i += count
    } else {
      blocks.push({ items: [items[i]] })
      i++
    }
  }
  return blocks
}

function FeedBlock({ items, blockIndex }: { items: NewsItem[]; blockIndex: number }) {
  const posInCycle = blockIndex % 3
  if (posInCycle !== 1) {
    const variant = posInCycle === 2 ? 'full-right' : 'full-left'
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant={variant} />
      </div>
    )
  }
  if (items.length === 1) {
    return (
      <div className="md:py-6 md:border-b md:border-border">
        <NewsCard item={items[0]} variant="full-left" />
      </div>
    )
  }
  return (
    <div className="md:py-6 md:border-b md:border-border">
      <div className={cn('grid gap-0 md:gap-6', items.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3')}>
        {items.map(item => <NewsCard key={item.id} item={item} variant="card" />)}
      </div>
    </div>
  )
}

export default function FavoritesPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/favorites/articles')
      .then(r => r.json())
      .then(data => { setItems(data.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const allBlocks = splitIntoBlocks(items)
  const shownBlocks = allBlocks.slice(0, visibleBlocks)
  const hasMore = visibleBlocks < allBlocks.length

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisibleBlocks(v => v + 4) },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading])

  return (
    <div className="flex-1 overflow-y-auto min-w-0">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-border header-blur">
        <div className="flex items-center h-12 px-4 md:hidden gap-2">
          <Bookmark size={18} className="text-ink-primary flex-shrink-0" />
          <h1 className="text-[15px] font-semibold text-ink-primary">Meus Favoritos</h1>
        </div>
        <div className="hidden md:flex items-center h-14 px-8">
          <Bookmark size={18} className="text-ink-primary flex-shrink-0 mr-2" />
          <h1 className="text-[15px] font-semibold text-ink-primary">Meus Favoritos</h1>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="feed-layout mx-auto px-4 md:px-8">
        <div className="pt-0 pb-24 md:py-6 md:pb-6">

          {loading && (
            <><SkeletonBlock /><SkeletonBlock /></>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <Bookmark size={40} className="text-ink-tertiary opacity-40" />
              <div>
                <p className="text-[15px] font-medium text-ink-secondary">Nenhum favorito ainda</p>
                <p className="text-[13px] text-ink-tertiary mt-1">Salve artigos clicando em favoritar enquanto lê.</p>
              </div>
              <Link href="/feed"
                className="mt-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white hover:opacity-80 transition-opacity"
                style={{ background: 'var(--color-ui-strong)' }}>
                Ver meu feed
              </Link>
            </div>
          )}

          {!loading && items.length > 0 && (
            <>
              {shownBlocks.map((block, i) => (
                <FeedBlock key={i} items={block.items} blockIndex={i} />
              ))}
              <div ref={sentinelRef}>
                {hasMore && <SkeletonBlock />}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
