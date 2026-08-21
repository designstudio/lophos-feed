'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { NewsItem, NewsSource } from '@/lib/types'
import { ArrowNarrowUpRight as ExternalLink, Clock as ClockCircle, X as CloseCircle, BookOpen01 as Documents, ThumbsDown as Dislike, Copy06 as Copy, Share07 as Share, Flag06 as ReportFlag } from '@untitledui/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tooltip } from '@/components/Tooltip'
import { useModalTransition } from '@/hooks/useModalTransition'
import { LikeBurstIcon } from '@/components/LikeBurstIcon'
import { TopicIcon } from '@/components/TopicIcon'
import { ArticleReportModal } from '@/components/ArticleReportModal'

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
    <div className="rounded-[1.5rem] overflow-hidden mb-8 bg-bg-secondary relative shadow-md aspect-video">
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
      className="spring-press flex flex-col gap-2 overflow-hidden rounded-[1rem] border border-border bg-white p-3 shadow-sm transition-all hover:border-border-strong group"
    >
      <div className="flex items-center">
        {src.favicon ? (
          <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />
        )}
      </div>
      <p className="text-[12px] font-medium text-ink-primary truncate leading-tight">
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

type ArticleReaction = 'like' | 'dislike' | null

export default function ArticlePageClient({ initialItem }: { initialItem: NewsItem }) {
  const id = initialItem.id
  const { isSignedIn } = useAuth()
  const item = initialItem
  const [showAllSources, setShowAllSources] = useState(false)
  const [related, setRelated] = useState<RelatedItem[]>([])
  const [relatedLoading, setRelatedLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeBurstToken, setLikeBurstToken] = useState(0)
  const [disliked, setDisliked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const imageModalTransition = useModalTransition(showImageModal)
  const scrollRef = useRef<HTMLDivElement>(null)
  const desiredReactionRef = useRef<ArticleReaction>(null)
  const persistedReactionRef = useRef<ArticleReaction>(null)
  const reactionSavingRef = useRef(false)
  const reactionReadyRef = useRef(false)
  const reactionChangedRef = useRef(false)

  const applyReactionState = useCallback((reaction: ArticleReaction) => {
    setLiked(reaction === 'like')
    setDisliked(reaction === 'dislike')
  }, [])

  const flushReactionQueue = useCallback(async () => {
    if (!reactionReadyRef.current || reactionSavingRef.current) return

    reactionSavingRef.current = true
    try {
      while (persistedReactionRef.current !== desiredReactionRef.current) {
        const reaction = desiredReactionRef.current
        const response = await fetch('/api/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: id, topic: item?.topic ?? '', reaction }),
        })

        if (!response.ok) throw new Error('Failed to update reaction')
        persistedReactionRef.current = reaction
      }
    } catch {
      desiredReactionRef.current = persistedReactionRef.current
      applyReactionState(persistedReactionRef.current)
    } finally {
      reactionSavingRef.current = false

      if (persistedReactionRef.current !== desiredReactionRef.current) {
        void flushReactionQueue()
      }
    }
  }, [applyReactionState, id, item?.topic])

  useEffect(() => {
    const controller = new AbortController()
    setRelated([])
    setRelatedLoading(true)

    fetch(`/api/article/related?id=${id}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load related articles')
        return r.json()
      })
      .then((data) => setRelated(data.items || []))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setRelatedLoading(false)
      })

    return () => controller.abort()
  }, [id])

  useEffect(() => {
    desiredReactionRef.current = null
    persistedReactionRef.current = null
    reactionReadyRef.current = false
    reactionChangedRef.current = false
    applyReactionState(null)

    if (!isSignedIn) return

    const controller = new AbortController()
    fetch('/api/reactions', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load reactions')
        return response.json()
      })
      .then((data) => {
        const reaction = ((data.reactions ?? {})[id] ?? null) as ArticleReaction
        persistedReactionRef.current = reaction
        reactionReadyRef.current = true

        if (reactionChangedRef.current) {
          void flushReactionQueue()
        } else {
          desiredReactionRef.current = reaction
          applyReactionState(reaction)
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
        reactionReadyRef.current = true
        if (reactionChangedRef.current) void flushReactionQueue()
      })

    return () => controller.abort()
  }, [applyReactionState, flushReactionQueue, id, isSignedIn])

  const updateReaction = (nextReaction: ArticleReaction) => {
    if (!isSignedIn) return
    reactionChangedRef.current = true
    desiredReactionRef.current = nextReaction
    if (nextReaction === 'like') setLikeBurstToken((token) => token + 1)
    applyReactionState(nextReaction)
    void flushReactionQueue()
  }

  const toggleLike = () => {
    updateReaction(desiredReactionRef.current === 'like' ? null : 'like')
  }

  const toggleDislike = () => {
    updateReaction(desiredReactionRef.current === 'dislike' ? null : 'dislike')
  }

  const copyArticle = async () => {
    const url = `${window.location.origin}/article/${id}`
    const sections = item?.sections
      ?.map((section) => `${section.heading}\n${section.body}`)
      .join('\n\n')
    const articleText = [
      item?.title,
      item?.summary,
      sections,
      `Leia no Lophos: ${url}`,
    ].filter(Boolean).join('\n\n')

    try {
      await navigator.clipboard.writeText(articleText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (navigator.share) {
        await navigator.share({ title: item?.title, text: articleText, url })
      }
    }
  }

  const shareArticle = async () => {
    const url = `${window.location.origin}/article/${id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: item?.title, url })
        return
      } catch {
        // If the share sheet is dismissed or unavailable, fall back to copy.
      }
    }

    await navigator.clipboard.writeText(url)
  }

  const shownSources = item?.sources?.slice(0, 3) || []
  const extraCount = (item?.sources?.length || 0) - 3

  useEffect(() => {
    if (imageModalTransition.rendered) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [imageModalTransition.rendered])

  return (
    <>
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div ref={scrollRef} id="article-scroll-container" className="flex-1 overflow-y-auto min-w-0 transition-all duration-300">
          <main className="page-scroll">
            <div
              className="article-layout mx-auto mt-[10vh] px-6 pb-24 md:pb-8"
            >
              <article className="animate-fade-in">
                  <span className="category-topic-pill">
                    <TopicIcon topic={item.topic} />
                    <span>{item.topic.charAt(0).toLocaleUpperCase('pt-BR') + item.topic.slice(1)}</span>
                  </span>
                  <h1 className="mt-2 mb-3 text-4xl leading-tight text-ink-primary">{item.title}</h1>

                  <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
                    <ClockCircle size={16} />
                    <span>Publicado {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}</span>
                  </div>

                  <p className="text-body text-ink-secondary leading-relaxed mb-8">{item.summary}</p>

                  {item.videoUrl ? (
                    <VideoPlayer url={item.videoUrl} title={item.title} />
                  ) : item.imageUrl ? (
                    <button
                      onClick={() => setShowImageModal(true)}
                      className="w-full mb-8 relative transform-gpu group cursor-zoom-in"
                      aria-label="Ampliar imagem da notícia"
                    >
                      <div className="relative h-full overflow-hidden rounded-[1.5rem] shadow-md hover:shadow-lg hover:scale-[1.02] transition-transform duration-150">
                        <img
                          src={`/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`}
                          alt={item.title}
                          className="article-image w-full h-auto"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                        />
                      </div>
                      {item.sources?.[0] && (
                        <div
                          className="absolute bottom-2 left-2 w-auto px-2 py-1.5 flex items-center gap-1.5 pointer-events-none rounded-md"
                          style={{ background: 'rgba(0,0,0,0.6)' }}
                        >
                          {item.sources[0].favicon && (
                            <img
                              src={item.sources[0].favicon}
                              alt=""
                              width={12}
                              height={12}
                              className="rounded-sm opacity-90"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <span className="text-[11px] text-white/80 font-medium">{item.sources[0].name}</span>
                        </div>
                      )}
                    </button>
                  ) : null}

                  {item.sections && item.sections.length > 0 && (
                    <div className="mb-8 space-y-10">
                      {item.sections.map((section, i) => (
                        <div key={i}>
                          <h2 className="mb-4 text-xl font-semibold text-ink-primary">{section.heading}</h2>
                          <p className="text-body text-ink-secondary leading-relaxed">{section.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-8">
                    <Tooltip content={liked ? 'Descurtir' : 'Curtir'}>
                      <motion.button
                        type="button"
                        onClick={toggleLike}
                        disabled={!isSignedIn}
                        aria-label={liked ? 'Descurtir' : 'Curtir'}
                        aria-pressed={liked}
                        whileTap={{ scale: 0.85 }}
                        className={cn(
                          'editorial-card__reaction--like flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                          liked
                            ? 'is-active'
                            : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary',
                          !isSignedIn && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        <LikeBurstIcon liked={liked} burstToken={likeBurstToken} size={16} />
                      </motion.button>
                    </Tooltip>

                    <Tooltip content={disliked ? 'Remover desinteresse' : 'Não tenho interesse'}>
                      <motion.button
                        type="button"
                        onClick={toggleDislike}
                        disabled={!isSignedIn}
                        aria-label={disliked ? 'Remover desinteresse' : 'Não tenho interesse'}
                        aria-pressed={disliked}
                        whileTap={{ scale: 0.85 }}
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                          disliked
                            ? 'bg-zinc-100 text-zinc-600'
                            : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary',
                          !isSignedIn && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={disliked ? 'filled' : 'outline'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            style={{ display: 'flex' }}
                          >
                            <Dislike size={16} />
                          </motion.span>
                        </AnimatePresence>
                      </motion.button>
                    </Tooltip>

                    <Tooltip content={copied ? 'Matéria copiada' : 'Copiar matéria'}>
                      <motion.button
                        type="button"
                        onClick={copyArticle}
                        aria-label={copied ? 'Matéria copiada' : 'Copiar matéria'}
                        whileTap={{ scale: 0.85 }}
                        className="flex items-center justify-center w-8 h-8 rounded-full text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary transition-colors"
                      >
                        <Copy size={16} />
                      </motion.button>
                    </Tooltip>

                    <Tooltip content="Compartilhar">
                      <motion.button
                        type="button"
                        onClick={shareArticle}
                        aria-label="Compartilhar notícia"
                        whileTap={{ scale: 0.85 }}
                        className="flex items-center justify-center w-8 h-8 rounded-full text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary transition-colors"
                      >
                        <Share size={16} />
                      </motion.button>
                    </Tooltip>

                    <Tooltip content="Reportar um problema">
                      <motion.button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        disabled={!isSignedIn}
                        aria-label="Reportar um problema nesta matéria"
                        whileTap={{ scale: 0.85 }}
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary transition-colors',
                          !isSignedIn && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        <ReportFlag size={16} />
                      </motion.button>
                    </Tooltip>

                  </div>

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
                          <button
                            onClick={() => setShowAllSources(true)}
                            className="spring-press flex min-w-[80px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[1.5rem] border border-border bg-white px-4 py-3 shadow-sm transition-all hover:border-border-strong"
                          >
                            <div className="flex items-center">
                              {item.sources.slice(3, 6).map((src, i) => (
                                <div
                                  key={i}
                                  className="w-4 h-4 rounded-full border-2 border-white overflow-hidden bg-bg-secondary"
                                  style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: 3 - i }}
                                >
                                  {src.favicon && (
                                    <img
                                      src={src.favicon}
                                      alt=""
                                      width={16}
                                      height={16}
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

                  {(relatedLoading || related.length > 0) && (
                    <div className="mt-16 mb-8">
                      <div className="flex items-center gap-2 mb-6">
                        <Documents size={24} className="text-ink-primary flex-shrink-0" />
                        <h2 className="text-lg font-semibold text-ink-primary">
                          Notícias relacionadas
                        </h2>
                      </div>
                      <div
                        className="grid grid-cols-2 md:grid-cols-4 gap-3"
                        aria-busy={relatedLoading}
                        aria-label={relatedLoading ? 'Carregando notícias relacionadas' : undefined}
                      >
                        {relatedLoading
                          ? Array.from({ length: 4 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'overflow-hidden rounded-[1.5rem] border border-border bg-bg-primary shadow-sm',
                                i >= 2 ? 'hidden md:block' : '',
                              )}
                              aria-hidden="true"
                            >
                              <div className="aspect-video w-full animate-pulse bg-bg-tertiary motion-reduce:animate-none" />
                              <div className="flex flex-col gap-2 p-3">
                                <span className="h-3.5 w-full animate-pulse rounded bg-bg-tertiary motion-reduce:animate-none" />
                                <span className="h-3.5 w-4/5 animate-pulse rounded bg-bg-tertiary motion-reduce:animate-none" />
                                <span className="mt-1 h-3 w-full animate-pulse rounded bg-bg-secondary motion-reduce:animate-none" />
                                <span className="h-3 w-2/3 animate-pulse rounded bg-bg-secondary motion-reduce:animate-none" />
                              </div>
                            </div>
                          ))
                          : related.slice(0, 4).map((rel, i) => (
                          <Link
                            key={rel.id}
                            href={`/article/${rel.id}`}
                            prefetch={false}
                            className={cn('spring-press flex flex-col gap-0 bg-bg-primary text-left group rounded-[1.5rem] border border-border shadow-sm overflow-hidden hover:border-border-strong transition-all', i >= 2 ? 'hidden md:flex' : '')}

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
                              <p className="text-[0.875rem] font-semibold text-ink-primary leading-snug line-clamp-2">
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
            </div>
          </main>
        </div>

        <div
          className={cn(
            'flex-shrink-0 overflow-hidden border-l border-border transition-[width,opacity] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            showAllSources ? 'duration-[400ms]' : 'duration-[350ms]',
          )}
          style={{ width: showAllSources ? '20rem' : '0', opacity: showAllSources ? 1 : 0 }}
        >
          <div className="w-80 h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0" style={{ height: '57px' }}>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {(item?.sources || []).slice(0, 3).map((src, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
                      style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: 3 - i }}
                    >
                      {src.favicon
                        ? <img src={src.favicon} alt="" width={20} height={20} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <span className="w-full h-full block bg-bg-tertiary" />}
                    </div>
                  ))}
                </div>
                <h2 className="text-lg font-semibold text-ink-primary">Fontes</h2>
              </div>
              <button onClick={() => setShowAllSources(false)} className="text-ink-tertiary hover:text-ink-primary transition-colors">
                <CloseCircle size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3">
              {(item?.sources || []).map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:opacity-70 transition-opacity group"
                >
                  {src.favicon
                    ? <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-primary truncate">{src.name}</p>
                    <p className="text-[11px] text-ink-muted truncate">{src.url}</p>
                  </div>
                  <ExternalLink size={14} className="flex-shrink-0 text-ink-muted" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {imageModalTransition.rendered && item?.imageUrl && createPortal(
        <div
          onClick={() => setShowImageModal(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
        >
          <div
            className={cn(
              't-modal absolute inset-0 flex items-center justify-center p-4',
              imageModalTransition.open && 'is-open',
              imageModalTransition.closing && 'is-closing',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Visualização ampliada da imagem"
            aria-hidden={!imageModalTransition.open}
            inert={!imageModalTransition.open}
            onClick={() => setShowImageModal(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowImageModal(false)
              }}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              aria-label="Fechar imagem"
            >
              <CloseCircle size={24} />
            </button>
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(item.imageUrl)}`}
              alt={item.title}
              className="max-w-full max-h-[90vh] rounded-[1.5rem] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}

      <ArticleReportModal
        articleId={id}
        articleTitle={item.title}
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </>
  )
}
