'use client'
import { useState } from 'react'
import Link from 'next/link'
import { NewsItem } from '@/lib/types'
import { HeartAngle, Dislike } from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

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
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact('like') }}
          className={cn('flex items-center px-2 py-1 rounded-full transition-all',
            reaction === 'like' ? 'bg-red-50 text-red-500' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
          )}>
          <HeartAngle size={16} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact('dislike') }}
          className={cn('flex items-center px-2 py-1 rounded-full transition-all',
            reaction === 'dislike' ? 'bg-red-50 text-red-500' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
          )}>
          <Dislike size={16} />
        </button>
      </div>
    </div>
  )
}

export function NewsCard({ item, variant = 'card', className }: Props) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null)
  const [reacting, setReacting] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const href = `/article/${item.id}`
  const proxiedImage = proxyImage(item.imageUrl)
  const showImage = !!proxiedImage && !imgFailed

  const react = async (type: 'like' | 'dislike') => {
    if (reacting) return
    setReacting(true)
    const newReaction = reaction === type ? null : type
    setReaction(newReaction)
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: item.id, topic: item.topic, reaction: newReaction }),
      })
    } catch (e) { console.error(e) }
    setReacting(false)
  }

  if (variant === 'card') {
    return (
      <Link href={href} className={cn('group flex flex-col', className)}>
        {showImage ? (
          <div className="w-full h-36 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mb-2.5">
            <img src={proxiedImage} alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgFailed(true)}
            />
          </div>
        ) : (
          <div className="w-full h-36 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mb-2.5 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary opacity-80" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-[10px] font-semibold text-ink-secondary bg-bg-primary/70 border border-border">
              {getSourceLabel(item.sources)}
            </div>
          </div>
        )}
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1">{item.topic}</span>
        <h2 className="text-card-title text-ink-primary group-hover:text-accent transition-colors">{item.title}</h2>
        <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
      </Link>
    )
  }

  if (variant === 'full-left') {
    return (
      <Link href={href} className={cn('group flex flex-col md:flex-row gap-4 md:gap-6 items-start', className)}>
        {/* Image: topo no mobile (order-first), direita no desktop (order-last) */}
        <div className="order-first md:order-last w-full md:w-80 md:flex-shrink-0 md:h-56 rounded-xl overflow-hidden bg-bg-secondary relative">
          {showImage ? (
            <img src={proxiedImage} alt={item.title}
              className="w-full h-48 md:h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
          <h2 className="text-card-title md:text-headline text-ink-primary group-hover:text-accent transition-colors mt-1">{item.title}</h2>
          <p className="hidden md:block text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
          <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
        </div>
      </Link>
    )
  }

  // full-right
  return (
    <Link href={href} className={cn('group flex flex-col md:flex-row gap-4 md:gap-6 items-start', className)}>
      {/* Image: já vem primeiro no DOM → topo no mobile, esquerda no desktop */}
      <div className="w-full md:w-80 md:flex-shrink-0 md:h-56 rounded-xl overflow-hidden bg-bg-secondary relative">
        {showImage ? (
          <img src={proxiedImage} alt={item.title}
            className="w-full h-48 md:h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        <h2 className="text-card-title md:text-headline text-ink-primary group-hover:text-accent transition-colors mt-1">{item.title}</h2>
        <p className="hidden md:block text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
        <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
      </div>
    </Link>
  )
}
