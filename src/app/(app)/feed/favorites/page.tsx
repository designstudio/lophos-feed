'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bookmark } from '@solar-icons/react-perf/Linear'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FavoriteItem {
  id: string
  topic: string
  title: string
  summary: string
  imageUrl: string
  publishedAt: string
  sources: { name: string; url: string; favicon: string }[]
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/favorites/articles')
      .then((r) => r.json())
      .then((data) => { setItems(data.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border px-4 md:px-8 header-blur">
        <div className="flex items-center h-12 md:h-14 gap-2">
          <Bookmark size={18} className="text-ink-primary flex-shrink-0" />
          <h1 className="text-[15px] font-semibold text-ink-primary">Meus Favoritos</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-8">

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-3 py-4 border-b border-border">
                <div className="w-20 h-20 rounded-xl bg-bg-secondary flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-2.5 bg-bg-secondary rounded w-16" />
                  <div className="h-4 bg-bg-secondary rounded w-full" />
                  <div className="h-4 bg-bg-secondary rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Bookmark size={40} className="text-ink-tertiary opacity-40" />
            <div>
              <p className="text-[15px] font-medium text-ink-secondary">Nenhum favorito ainda</p>
              <p className="text-[13px] text-ink-tertiary mt-1">Salve artigos clicando em "Salvar" enquanto lê.</p>
            </div>
            <Link href="/feed"
              className="mt-2 px-4 py-2 rounded-lg bg-ink-primary text-bg-primary text-[13px] font-medium hover:opacity-80 transition-opacity">
              Ver meu feed
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <Link key={item.id} href={`/article/${item.id}`}
                className="flex items-start gap-4 py-4 group hover:opacity-80 transition-opacity"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
                  <h2 className="text-[14px] font-semibold text-ink-primary leading-snug mt-0.5 mb-1 line-clamp-2 group-hover:text-accent transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-[12px] text-ink-tertiary line-clamp-2 leading-relaxed mb-2 hidden sm:block">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-2">
                    {item.sources?.[0]?.favicon && (
                      <img src={item.sources[0].favicon} alt="" width={12} height={12} className="rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <span className="text-[11px] text-ink-tertiary">
                      {item.sources?.[0]?.name}
                      {item.sources?.length > 1 && ` +${item.sources.length - 1}`}
                    </span>
                    <span className="text-[11px] text-ink-tertiary">·</span>
                    <span className="text-[11px] text-ink-tertiary">
                      {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
