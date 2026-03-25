'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { NewsItem, NewsSource } from '@/lib/types'
import { SquareTopDown, ClockCircle, CloseCircle, Documents, ArrowLeft, Bookmark, Share } from '@solar-icons/react-perf/Linear'
import { Bookmark as BookmarkFilled } from '@solar-icons/react-perf/Bold'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractVimeoId(url: string): string | null {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function VideoPlayer({ url, title }: { url: string; title: string }) {
  const youtubeId = extractYouTubeId(url)
  const vimeoId = extractVimeoId(url)

  if (!youtubeId && !vimeoId) return null

  const iframeUrl = vimeoId
    ? `https://player.vimeo.com/video/${vimeoId}`
    : `https://www.youtube.com/embed/${youtubeId}`

  return (
    <div className="rounded-[1rem] overflow-hidden mb-6 bg-bg-secondary relative shadow-md aspect-video">
      <iframe
        className="w-full h-full"
        src={iframeUrl}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

function SourceCard({ src }: { src: NewsSource }) {
  return (
    <a href={src.url} target="_blank" rel="noopener noreferrer"
      className="flex flex-col gap-2 p-3 rounded-[1rem] border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all group"
    >
      <div className="flex items-center">
        {src.favicon ? (
          <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />
        )}
      </div>
      <p className="text-[12px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate leading-tight">
        {src.name}
      </p>
    </a>
  )
}

interface RelatedItem {
  id: string
  topic: string
  title: string
  summary: string
  imageUrl: string
  publishedAt: string
}

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [showAllSources, setShowAllSources] = useState(false)
  const [related, setRelated] = useState<RelatedItem[]>([])
  const [favorited, setFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleRef  = useRef<HTMLHeadingElement>(null)
  const [showTitle, setShowTitle] = useState(false)
  const prevId = useRef<string | null>(null)

  useEffect(() => {
    const isNavigation = prevId.current !== null && prevId.current !== id
    prevId.current = id

    if (isNavigation) {
      // Smooth content swap — fade out, fetch, fade in
      setTransitioning(true)
      scrollRef.current?.scrollTo({ top: 0 })
    } else {
      setLoading(true)
    }

    setShowAllSources(false)
    setShowTitle(false)

    fetch(`/api/article?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setItem(data.item || null)
        setLoading(false)
        setTransitioning(false)
      })
      .catch(() => { setLoading(false); setTransitioning(false) })

    fetch(`/api/article/related?id=${id}`)
      .then((r) => r.json())
      .then((data) => setRelated(data.items || []))
      .catch(() => {})
  }, [id])

  // Load favorite state
  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((data) => setFavorited((data.ids || []).includes(id)))
      .catch(() => {})
  }, [id, isSignedIn])

  const toggleFavorite = async () => {
    if (!isSignedIn || favLoading) return
    setFavLoading(true)
    const newState = !favorited
    setFavorited(newState)
    try {
      await fetch('/api/favorites', {
        method: newState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      })
    } catch {
      setFavorited(!newState)
    }
    setFavLoading(false)
  }

  const shareArticle = () => {
    const url = `${window.location.origin}/article/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      if (navigator.share) navigator.share({ title: item?.title, url })
    })
  }

  const navigateTo = (targetId: string) => {
    router.push(`/article/${targetId}`)
  }

  const shownSources = item?.sources?.slice(0, 3) || []
  const extraCount = (item?.sources?.length || 0) - 3

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (!titleRef.current) return
      setShowTitle(titleRef.current.getBoundingClientRect().bottom < 56)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Lock scroll when modal is open
  useEffect(() => {
    if (showImageModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showImageModal])

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-w-0 transition-all duration-300">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 border-b border-border px-4 md:px-8 header-blur">
          <div className="flex items-center h-12 md:h-14 gap-3">

            {/* Back button — Perplexity style */}
            <Link href="/feed"
              className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-[1rem] border border-border hover:bg-bg-secondary text-[13px] font-medium text-ink-secondary hover:text-ink-primary transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} className="flex-shrink-0" />
              <span className="hidden sm:inline">Voltar para Meu feed</span>
            </Link>

            {/* Article title — appears when scrolled past h1 */}
            <div className="flex-1 flex justify-center overflow-hidden px-2">
              <span
                className="text-[0.875rem] font-medium text-ink-primary truncate max-w-lg transition-all duration-200"
                style={{ opacity: showTitle ? 1 : 0, transform: showTitle ? 'translateY(0)' : 'translateY(4px)' }}
              >
                {item?.title}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Bookmark — icon only */}
              {isSignedIn && (
                <button
                  onClick={toggleFavorite}
                  title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-bg-secondary"
                >
                  {favorited
                    ? <BookmarkFilled size={18} style={{ color: 'var(--color-accent)' }} />
                    : <Bookmark size={18} className="text-ink-secondary" />
                  }
                </button>
              )}

              {/* Share */}
              <button
                onClick={shareArticle}
                className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-[1rem] text-[13px] font-medium text-white hover:opacity-80"
                style={{ background: 'var(--color-ui-strong)' }}
              >
                <Share size={14} />
                <span>{copied ? 'Link copiado!' : 'Compartilhar'}</span>
              </button>
            </div>

          </div>
        </div>

        <main className="page-scroll">
          <div
            className="article-layout mx-auto py-6 px-4 md:px-8 pb-24 md:pb-8 transition-opacity duration-200"
            style={{ opacity: transitioning ? 0 : 1 }}
          >

            {loading && (
              <div className="space-y-4 animate-pulse">
                <div className="h-3 bg-bg-secondary rounded w-20" />
                <div className="h-9 bg-bg-secondary rounded w-4/5" />
                <div className="h-9 bg-bg-secondary rounded w-3/5" />
                <div className="h-3 bg-bg-secondary rounded w-32" />
                <div className="h-56 bg-bg-secondary rounded-[1rem]" />
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-4 bg-bg-secondary rounded" style={{ width: `${100 - i*5}%` }} />)}
                </div>
              </div>
            )}

            {!loading && !item && (
              <div className="text-center py-20 text-ink-tertiary">Artigo não encontrado.</div>
            )}

            {!loading && item && (
              <article className="animate-fade-in">
                {/* Topic + title */}
                <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
                <h1 ref={titleRef} className="text-ink-primary leading-tight mt-2 mb-3" style={{ fontSize: '2.3rem', lineHeight: '1.25' }}>{item.title}</h1>

                {/* Recency */}
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
                  <ClockCircle size={16} />
                  <span>Publicado {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}</span>
                </div>

                {/* Hero media — video or image */}
                {item.videoUrl ? (
                  <VideoPlayer url={item.videoUrl} title={item.title} />
                ) : item.imageUrl ? (
                  <button
                    onClick={() => setShowImageModal(true)}
                    className="w-full rounded-[1rem] overflow-hidden mb-6 bg-bg-secondary relative shadow-md hover:shadow-lg transition-all duration-300 cursor-zoom-in group"
                  >
                    <img src={`/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`} alt={item.title} className="article-image w-full group-hover:scale-[1.02] transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                    {item.sources?.[0] && (
                      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-1.5"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}>
                        {item.sources[0].favicon && (
                          <img src={item.sources[0].favicon} alt="" width={12} height={12} className="rounded-sm opacity-90"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <span className="text-[11px] text-white/80 font-medium">{item.sources[0].name}</span>
                      </div>
                    )}
                  </button>
                ) : null}

                {/* Image Modal */}
                {showImageModal && item?.imageUrl && (
                  <div
                    onClick={() => setShowImageModal(false)}
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowImageModal(false)
                      }}
                      className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                    >
                      <CloseCircle size={24} />
                    </button>
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`}
                      alt={item.title}
                      className="max-w-full max-h-[90vh] rounded-[1rem] shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Summary */}
                <p className="text-body text-ink-secondary leading-relaxed mb-8">{item.summary}</p>

                {/* Sections */}
                {item.sections && item.sections.length > 0 && (
                  <div className="space-y-6 mb-8">
                    {item.sections.map((section, i) => (
                      <div key={i}>
                        <h2 className="text-[15px] font-semibold text-ink-primary mb-2">{section.heading}</h2>
                        <p className="text-body text-ink-secondary leading-relaxed">{section.body}</p>
                      </div>
                    ))}
                  </div>
                )}


                {/* Sources */}
                {item.sources && item.sources.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-3">
                      {item.sources.length} fonte{item.sources.length !== 1 ? 's' : ''}
                    </h2>
                    <div className="flex gap-2 items-stretch">
                      {shownSources.map((src, i) => (
                        <div key={i} className="flex-1 min-w-0"><SourceCard src={src} /></div>
                      ))}
                      {extraCount > 0 && (
                        <button onClick={() => setShowAllSources(true)}
                          className="flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-[1rem] border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all min-w-[80px]"
                        >
                          <div className="flex items-center">
                            {item.sources.slice(3, 6).map((src, i) => (
                              <div key={i} className="w-4 h-4 rounded-full border-2 border-white overflow-hidden bg-bg-secondary"
                                style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: 3 - i }}>
                                {src.favicon && <img src={src.favicon} alt="" width={16} height={16} className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                              </div>
                            ))}
                          </div>
                          <span className="text-[12px] font-medium text-ink-secondary whitespace-nowrap">+{extraCount} fontes</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Related articles — Perplexity "Descubra mais" style */}
                {related.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-6">
                      <Documents size={24} className="text-ink-primary flex-shrink-0" />
                      <h2 className="font-semibold text-ink-primary" style={{ fontSize: '1.125rem' }}>
                        Notícias relacionadas
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {related.slice(0, 4).map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/article/${rel.id}`}
                          className="spring-press flex flex-col gap-0 text-left group rounded-[1rem] border border-border shadow-sm overflow-hidden hover:border-border-strong transition-all"
                        >
                          {rel.imageUrl && (
                            <div className="bg-bg-secondary aspect-video w-full overflow-hidden">
                              <img
                                src={`/api/image-proxy?url=${encodeURIComponent(rel.imageUrl)}`}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                              />
                            </div>
                          )}
                          <div className="p-3 flex flex-col gap-1">
                            <p className="text-[0.875rem] font-semibold text-ink-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                              {rel.title}
                            </p>
                            <p className="text-[12px] text-ink-tertiary leading-relaxed line-clamp-2">
                              {rel.summary}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )}
          </div>
        </main>
      </div>

      {/* ── Sources panel ── */}
      <div
        className="flex-shrink-0 border-l border-border overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: showAllSources ? '20rem' : '0', opacity: showAllSources ? 1 : 0 }}
      >
        <div className="w-80 h-full flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0" style={{ height: '57px' }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {(item?.sources || []).slice(0, 3).map((src, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
                    style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: 3 - i }}>
                    {src.favicon
                      ? <img src={src.favicon} alt="" width={20} height={20} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <span className="w-full h-full block bg-bg-tertiary" />}
                  </div>
                ))}
              </div>
              <h2 className="text-[15px] font-semibold text-ink-primary">Fontes</h2>
            </div>
            <button onClick={() => setShowAllSources(false)} className="text-ink-tertiary hover:text-ink-primary transition-colors">
              <CloseCircle size={20} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-4 py-3">
            {(item?.sources || []).map((src, i) => (
              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:opacity-70 transition-opacity group"
              >
                {src.favicon
                  ? <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate">{src.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">{src.url}</p>
                </div>
                <SquareTopDown size={12} className="text-ink-muted flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
