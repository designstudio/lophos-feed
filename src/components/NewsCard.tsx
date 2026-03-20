'use client'
import { useState } from 'react'
import Link from 'next/link'
import { NewsItem } from '@/lib/types'
import { HeartAngle, Dislike } from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

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
              className="w-4 h-4 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
              style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: shown.length - i }}
            >
              {src.favicon ? (
                <img src={src.favicon} alt="" width={16} height={16}
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
          <HeartAngle size={13} />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReact('dislike') }}
          className={cn('flex items-center px-2 py-1 rounded-full transition-all',
            reaction === 'dislike' ? 'bg-red-50 text-red-500' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
          )}>
          <Dislike size={13} />
        </button>
      </div>
    </div>
  )
}

export function NewsCard({ item, variant = 'card', className }: Props) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null)
  const [reacting, setReacting] = useState(false)
  const href = `/article/${item.id}`

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
        {item.imageUrl && (
          <div className="w-full h-36 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mb-2.5">
            <img src={item.imageUrl} alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
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
      <Link href={href} className={cn('group flex gap-6 items-start', className)}>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
          <h2 className="text-headline text-ink-primary group-hover:text-accent transition-colors mt-1">{item.title}</h2>
          <p className="text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
          <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
        </div>
        {item.imageUrl && (
          <div className="flex-shrink-0 rounded-xl overflow-hidden bg-bg-secondary" style={{ width: '20rem', height: '14rem' }}>
            <img src={item.imageUrl} alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
          </div>
        )}
      </Link>
    )
  }

  return (
    <Link href={href} className={cn('group flex gap-6 items-start', className)}>
      {item.imageUrl && (
        <div className="flex-shrink-0 rounded-xl overflow-hidden bg-bg-secondary" style={{ width: '20rem', height: '14rem' }}>
          <img src={item.imageUrl} alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
        <h2 className="text-headline text-ink-primary group-hover:text-accent transition-colors mt-1">{item.title}</h2>
        <p className="text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
        <SourcesAndReactions sources={item.sources} reaction={reaction} onReact={react} />
      </div>
    </Link>
  )
}
