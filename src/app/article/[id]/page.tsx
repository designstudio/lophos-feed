'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { NewsItem, NewsSource } from '@/lib/types'
import { AltArrowLeft, SquareTopDown, Calendar, CloseCircle } from '@solar-icons/react-perf/Linear'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Source card (compact, shown in article) ────────────────
function SourceCard({ src }: { src: NewsSource }) {
  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all group"
    >
      <div className="flex items-center justify-between">
        {src.favicon ? (
          <img src={src.favicon} alt="" width={20} height={20}
            className="rounded-md flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />
        )}
        <SquareTopDown size={12} className="text-ink-muted" />
      </div>
      <p className="text-[12px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate leading-tight">
        {src.name}
      </p>
    </a>
  )
}

// ─── Sources sidebar (all sources) ──────────────────────────
function SourcesSidebar({ sources, onClose }: { sources: NewsSource[]; onClose: () => void }) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white border-l border-border z-50 flex flex-col animate-slide-in-right shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {/* Overlapping favicons preview */}
            <div className="flex items-center">
              {sources.slice(0, 3).map((src, i) => (
                <div key={i}
                  className="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-bg-secondary flex-shrink-0"
                  style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: 3 - i }}
                >
                  {src.favicon ? (
                    <img src={src.favicon} alt="" width={20} height={20} className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <span className="w-full h-full block bg-bg-tertiary" />
                  )}
                </div>
              ))}
            </div>
            <h2 className="text-[15px] font-semibold text-ink-primary">Fontes</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <CloseCircle size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3">
          {sources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:opacity-70 transition-opacity group"
            >
              {src.favicon ? (
                <img src={src.favicon} alt="" width={20} height={20}
                  className="rounded-md flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate">{src.name}</p>
                <p className="text-[11px] text-ink-muted truncate">{src.url}</p>
              </div>
              <SquareTopDown size={12} className="text-ink-muted flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Page ────────────────────────────────────────────────────
export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllSources, setShowAllSources] = useState(false)

  useEffect(() => {
    fetch(`/api/article?id=${id}`)
      .then((r) => r.json())
      .then((data) => { setItem(data.item || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const shownSources = item?.sources?.slice(0, 3) || []
  const extraCount = (item?.sources?.length || 0) - 3

  return (
    <div className="page-shell">
      <Sidebar />

      <main className="page-scroll">
        <div className="article-layout mx-auto py-6">
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
            <div className="text-center py-20 text-ink-tertiary">Artigo não encontrado.</div>
          )}

          {!loading && item && (
            <article className="animate-fade-in">
              <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>

              <h1 className="text-headline text-ink-primary leading-tight mt-2 mb-4">{item.title}</h1>

              <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
                <Calendar size={12} />
                <span>
                  {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>

              {item.imageUrl && (
                <div className="rounded-xl overflow-hidden mb-6 bg-bg-secondary">
                  <img src={item.imageUrl} alt={item.title}
                    className="article-image"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                  />
                </div>
              )}

              <div className="text-body text-ink-secondary mb-8">{item.summary}</div>

              {/* Sources — 3 cards + "+X fontes" button */}
              {item.sources && item.sources.length > 0 && (
                <div>
                  <h2 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-3">
                    {item.sources.length} fonte{item.sources.length !== 1 ? 's' : ''}
                  </h2>
                  <div className="flex gap-2 items-stretch">
                    {shownSources.map((src, i) => (
                      <div key={i} className="flex-1 min-w-0">
                        <SourceCard src={src} />
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <button
                        onClick={() => setShowAllSources(true)}
                        className="flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all min-w-[80px]"
                      >
                        {/* Overlapping favicons of extra sources */}
                        <div className="flex items-center">
                          {item.sources.slice(3, 6).map((src, i) => (
                            <div key={i}
                              className="w-4 h-4 rounded-full border-2 border-white overflow-hidden bg-bg-secondary"
                              style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: 3 - i }}
                            >
                              {src.favicon && (
                                <img src={src.favicon} alt="" width={16} height={16}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] font-medium text-ink-secondary whitespace-nowrap">+{extraCount} fontes</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 rounded-2xl border border-border bg-bg-secondary">
                <p className="text-sm text-ink-secondary text-center">
                  Quer saber mais sobre este assunto?{' '}
                  <a href="/feed" className="text-accent hover:underline">Pergunte ao Lophos</a>
                </p>
              </div>
            </article>
          )}
        </div>
      </main>

      {/* Sources sidebar */}
      {showAllSources && item?.sources && (
        <SourcesSidebar sources={item.sources} onClose={() => setShowAllSources(false)} />
      )}
    </div>
  )
}
