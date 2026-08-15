'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Heart as HeartAngle } from '@untitledui/icons'
import { NewsCard } from '@/components/NewsCard'
import { SkeletonBlock } from '@/components/SkeletonCard'
import { NewsItem } from '@/lib/types'

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
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})
  const [visibleBlocks, setVisibleBlocks] = useState(4)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/favorites/articles')
      .then(r => r.json())
      .then(data => { setItems(data.items || []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/reactions')
      .then(r => r.json())
      .then(data => setReactions(data.reactions ?? {}))
      .catch(() => {})
  }, [])

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
    }
  }

  // Filtra para mostrar apenas artigos ainda curtidos
  const likedItems = items.filter(item => reactions[item.id] !== 'dislike')
  const allBlocks = splitIntoBlocks(likedItems)
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
    <div className="editorial-page-scroll">
      <header className="editorial-feed-hero">
        <h1>Minhas curtidas</h1>
        <p>As histórias que você guardou para voltar depois</p>
      </header>

      <div className="editorial-feed-layout">
        <div className="pb-24 md:pb-10">

          {loading && (
            <div className="editorial-card-stack">
              <SkeletonBlock /><SkeletonBlock />
            </div>
          )}

          {!loading && likedItems.length === 0 && (
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

          {!loading && likedItems.length > 0 && (
            <div className="editorial-card-stack">
              {shownBlocks.map((block) => (
                <FeedBlock key={block.items[0].id} items={block.items} reactions={reactions} onReactionChange={handleReactionChange} />
              ))}
              {hasMore && <div ref={sentinelRef}><SkeletonBlock /></div>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
