'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NewsItem } from '@/lib/types'
import { HeartAngle, Dislike } from '@solar-icons/react-perf/Linear'
import { Heart as HeartFilled, Dislike as DislikeFilled } from '@solar-icons/react-perf/Bold'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/Tooltip'

const LAZY_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif']

function proxyImage(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (LAZY_PATTERNS.some(p => url.toLowerCase().includes(p))) return undefined
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

function getSourceLabel(sources: NewsItem['sources']): string {
  const name = sources?.[0]?.name?.trim()
  if (!name) return 'Fonte'
  const parts = name.replace(/\s+/g, ' ').split(' ')
  const initials = parts.slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return initials || name.slice(0, 2).toUpperCase()
}

interface Props {
  item: NewsItem
  variant?: 'full-left' | 'full-right' | 'card'
  className?: string
  initialReaction?: 'like' | 'dislike' | null
  fadingOut?: boolean
  onReactionChange?: (articleId: string, reaction: 'like' | 'dislike' | null) => void
}

function SourcesAndReactions({ sources, reaction, onReact }: {
  sources: NewsItem['sources']
  reaction: 'like' | 'dislike' | null
  onReact: (t: 'like' | 'dislike') => void
}) {
  const shown = (sources || []).slice(0, 4)
  return (
    <div className="flex items-center justify-between mt-2.5">
      {/* Sources — left */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          {shown.map((src, i) => (
            <div key={i}
              className="w-5 h-5 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
              style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: shown.length - i }}
            >
              {src.favicon ? (
                <img src={src.favicon} alt="" width={20} height={20}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="w-full h-full block bg-bg-tertiary" />
              )}
            </div>
          ))}
        </div>
        {shown.length > 0 && (
          <span className="text-[11px] text-ink-tertiary font-medium">
            {sources!.length} {sources!.length === 1 ? 'fonte' : 'fontes'}
          </span>
        )}
      </div>
      {/* Reactions — right */}
      <div className="flex items-center gap-0.5">
        {/* Like com animação de pop */}
        <Tooltip content="Curtir" side="top">
          <motion.button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact('like') }}
            whileTap={{ scale: 0.85 }}
            className={cn('flex items-center px-2 py-1 rounded-full transition-colors',
              reaction === 'like' ? 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
            )}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={reaction === 'like' ? 'filled' : 'outline'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ display: 'flex' }}
              >
                {reaction === 'like' ? <HeartFilled size={16} /> : <HeartAngle size={16} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </Tooltip>

        {/* Dislike com animação de pop — tom neutro zinc quando ativo */}
        <Tooltip content="Não tenho interesse" side="top">
          <motion.button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact('dislike') }}
            whileTap={{ scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={cn('flex items-center px-2 py-1 rounded-full transition-colors',
              reaction === 'dislike' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
            )}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={reaction === 'dislike' ? 'filled' : 'outline'}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                style={{ display: 'flex' }}
              >
                {reaction === 'dislike' ? <DislikeFilled size={16} /> : <Dislike size={16} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </Tooltip>
      </div>
    </div>
  )
}

// Imagem do card — mesma altura em todos os variants no mobile (via CSS global)
function CardImage({ proxiedImage, title, sources, onError }: {
  proxiedImage: string | undefined
  title: string
  sources: NewsItem['sources']
  onError: () => void
}) {
  const showImage = !!proxiedImage
  return (
    <div className="news-card-image h-36 w-full rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mb-2.5 relative">
      {showImage ? (
        <img src={proxiedImage} alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={onError}
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary opacity-80" />
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold text-ink-secondary bg-bg-primary/70 border border-border">
            {getSourceLabel(sources)}
          </div>
        </>
      )}
    </div>
  )
}

export function NewsCard({ item, variant = 'card', className, initialReaction = null, fadingOut = false, onReactionChange }: Props) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(initialReaction)
  const [reacting, setReacting] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const href = `/article/${item.id}`
  const proxiedImage = proxyImage(item.imageUrl)
  const showImage = !!proxiedImage && !imgFailed

  // Sync when parent loads reactions from API
  useEffect(() => { setReaction(initialReaction) }, [initialReaction])

  const react = async (type: 'like' | 'dislike') => {
    if (reacting) return
    setReacting(true)
    const newReaction = reaction === type ? null : type
    setReaction(newReaction)
    onReactionChange?.(item.id, newReaction)
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: item.id, topic: item.topic, reaction: newReaction }),
      })
    } catch (e) { console.error(e) }
    setReacting(false)
  }

  // ── Mobile: todos os variants usam o mesmo layout coluna única ──
  // Padrão: imagem → categoria → título → fontes+reações → divider
  // Desktop: layout específico por variant

  if (variant === 'card') {
    return (
      <Link href={href} className={cn('news-card group flex flex-col pt-4 pb-4 border-b border-border md:pt-0 md:pb-0 md:border-b-0 transition-opacity duration-300', fadingOut && 'opacity-0 pointer-events-none', className)}>
        <CardImage proxiedImage={showImage ? proxiedImage : undefined} title={item.title} sources={item.sources} onError={() => setImgFailed(true)} />
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1">{item.displayTopic ?? item.topic}</span>
        <h2
          className="text-card-title text-ink-primary group-hover:text-accent transition-colors line-clamp-3"
          style={{ height: 'calc(3 * 1.625rem)' }}
        >{item.title}</h2>
        <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
      </Link>
    )
  }

  if (variant === 'full-left') {
    return (
      <Link href={href} className={cn('news-card group flex flex-col md:flex-row gap-0 md:gap-6 items-start pt-4 pb-4 border-b border-border md:pt-0 md:pb-0 md:border-b-0 transition-opacity duration-300', fadingOut && 'opacity-0 pointer-events-none', className)}>
        {/* Mobile: imagem no topo. Desktop: imagem à direita (order-last) */}
        <div className="news-card-image order-first md:order-last w-full md:w-80 md:flex-shrink-0 md:h-56 rounded-xl overflow-hidden bg-bg-secondary relative mb-2.5 md:mb-0">
          {showImage ? (
            <img src={proxiedImage} alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary opacity-80" />
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-[11px] font-semibold text-ink-secondary bg-bg-primary/70 border border-border">
                {getSourceLabel(item.sources)}
              </div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.displayTopic ?? item.topic}</span>
          <h2
            className="text-headline text-ink-primary group-hover:text-accent transition-colors mt-1 line-clamp-3"
            style={{ height: 'calc(3 * 1.75rem * 1.20)' }}
          >{item.title}</h2>
          <div className="hidden md:block">
            <p className="text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
          </div>
          <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
        </div>
      </Link>
    )
  }

  // full-right
  return (
    <Link href={href} className={cn('news-card group flex flex-col md:flex-row gap-0 md:gap-6 items-start pt-4 pb-4 border-b border-border md:pt-0 md:pb-0 md:border-b-0 transition-opacity duration-300', fadingOut && 'opacity-0 pointer-events-none', className)}>
      {/* Mobile: imagem no topo. Desktop: imagem à esquerda */}
      <div className="news-card-image w-full md:w-80 md:flex-shrink-0 md:h-56 rounded-xl overflow-hidden bg-bg-secondary relative mb-2.5 md:mb-0">
        {showImage ? (
          <img src={proxiedImage} alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary opacity-80" />
            <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-[11px] font-semibold text-ink-secondary bg-bg-primary/70 border border-border">
              {getSourceLabel(item.sources)}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
        <h2
          className="text-headline text-ink-primary group-hover:text-accent transition-colors mt-1 line-clamp-3"
          style={{ height: 'calc(3 * 1.75rem * 1.20)' }}
        >{item.title}</h2>
        <div className="hidden md:block">
          <p className="text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
        </div>
        <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
      </div>
    </Link>
  )
}
