'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { NewsItem } from '@/lib/types'
import { AltArrowLeft, SquareTopDown, Calendar } from '@solar-icons/react-perf/Linear'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/article?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setItem(data.item || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />

      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-ink-tertiary hover:text-ink-primary transition-colors mb-6"
          >
            <AltArrowLeft size={15} />
            Voltar
          </button>

          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-bg-secondary rounded w-20" />
              <div className="h-8 bg-bg-secondary rounded w-4/5" />
              <div className="h-8 bg-bg-secondary rounded w-3/5" />
              <div className="h-48 bg-bg-secondary rounded-xl" />
              <div className="space-y-2">
                <div className="h-4 bg-bg-secondary rounded w-full" />
                <div className="h-4 bg-bg-secondary rounded w-full" />
                <div className="h-4 bg-bg-secondary rounded w-3/4" />
              </div>
            </div>
          )}

          {!loading && !item && (
            <div className="text-center py-20 text-ink-tertiary">
              Artigo não encontrado.
            </div>
          )}

          {!loading && item && (
            <article className="animate-fade-in">
              {/* Topic */}
              <span className="text-xs font-medium text-ink-tertiary uppercase tracking-wider">
                {item.topic}
              </span>

              {/* Title */}
              <h1 className="font-display text-3xl text-ink-primary leading-tight mt-2 mb-4">
                {item.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
                <Calendar size={12} />
                <span>
                  {formatDistanceToNow(new Date(item.publishedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>

              {/* Image */}
              {item.imageUrl && (
                <div className="rounded-xl overflow-hidden mb-6 bg-bg-secondary">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-64 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                  />
                </div>
              )}

              {/* Summary */}
              <div className="text-ink-secondary text-base leading-relaxed mb-8">
                {item.summary}
              </div>

              {/* Sources */}
              {item.sources && item.sources.length > 0 && (
                <div>
                  <h2 className="text-xs font-medium text-ink-tertiary uppercase tracking-wider mb-3">
                    {item.sources.length} fonte{item.sources.length !== 1 ? 's' : ''}
                  </h2>
                  <div className="grid gap-2">
                    {item.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all group"
                      >
                        {src.favicon && (
                          <img
                            src={src.favicon}
                            alt=""
                            width={16}
                            height={16}
                            className="rounded-sm flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-primary group-hover:text-accent transition-colors truncate">
                            {src.name}
                          </p>
                          <p className="text-xs text-ink-muted truncate">{src.url}</p>
                        </div>
                        <SquareTopDown size={13} className="text-ink-muted flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Ask follow-up prompt */}
              <div className="mt-8 p-4 rounded-2xl border border-border bg-bg-secondary">
                <p className="text-sm text-ink-secondary text-center">
                  Quer saber mais sobre este assunto?{' '}
                  <a href="/" className="text-accent hover:underline">
                    Pergunte ao Lophos
                  </a>
                </p>
              </div>
            </article>
          )}
        </div>
      </main>
    </div>
  )
}
