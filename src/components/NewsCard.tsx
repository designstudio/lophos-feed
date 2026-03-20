'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewsItem } from '@/lib/types'
import { Like, Dislike } from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

interface Props {
  item: NewsItem
  variant?: 'full-left' | 'full-right' | 'card'
  className?: string
}

function Sources({ sources }: { sources: NewsItem['sources'] }) {
  if (!sources || sources.length === 0) return null
  const shown = sources.slice(0, 4)
  return (
    <div className="flex items-center gap-1.5 mt-2">
      {/* Overlapping favicons */}
      <div className="flex items-center">
        {shown.map((src, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
            style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: shown.length - i }}
          >
            {src.favicon ? (
              <img
                src={src.favicon}
                alt=""
                width={16}
                height={16}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <span className="w-full h-full block bg-bg-tertiary" />
            )}
          </div>
        ))}
      </div>
      {/* Source count */}
      <span className="text-[11px] text-ink-tertiary font-medium">
        {sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}
      </span>
    </div>
  )
}

function Reactions({ reaction, onReact }: { reaction: 'like' | 'dislike' | null; onReact: (t: 'like' | 'dislike') => void }) {
  return (
    <div className="flex items-center gap-1 mt-2.5">
      <button onClick={() => onReact('like')}
        className={cn('reaction-btn flex items-center px-2 py-1 rounded-full transition-all',
          reaction === 'like' ? 'bg-green-50 text-green-600' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
        )}>
        <Like size={12} />
      </button>
      <button onClick={() => onReact('dislike')}
        className={cn('reaction-btn flex items-center px-2 py-1 rounded-full transition-all',
          reaction === 'dislike' ? 'bg-red-50 text-red-500' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
        )}>
        <Dislike size={12} />
      </button>
    </div>
  )
}

export function NewsCard({ item, variant = 'card', className }: Props) {
  const router = useRouter()
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(null)
  const [reacting, setReacting] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.reaction-btn')) return
    router.push(`/article/${item.id}`)
  }

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
      <article onClick={handleClick} className={cn('cursor-pointer group flex flex-col', className)}>
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
        <Sources sources={item.sources} />
        <Reactions reaction={reaction} onReact={react} />
      </article>
    )
  }

  if (variant === 'full-left') {
    return (
      <article onClick={handleClick} className={cn('cursor-pointer group flex gap-6 items-start', className)}>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
          <h2 className="text-headline text-ink-primary group-hover:text-accent transition-colors mt-1">{item.title}</h2>
          <p className="text-body text-ink-secondary mt-2 line-clamp-3">{item.summary}</p>
          <Sources sources={item.sources} />
          <Reactions reaction={reaction} onReact={react} />
        </div>
        {item.imageUrl && (
          <div className="flex-shrink-0 w-52 h-36 rounded-xl overflow-hidden bg-bg-secondary">
            <img src={item.imageUrl} alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
          </div>
        )}
      </article>
    )
  }

  return (
    <article onClick={handleClick} className={cn('cursor-pointer group flex gap-6 items-start', className)}>
      {item.imageUrl && (
        <div className="flex-shrink-0 w-52 h-36 rounded-xl overflow-hidden bg-bg-secondary">
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
        <Sources sources={item.sources} />
        <Reactions reaction={reaction} onReact={react} />
      </div>
    </article>
  )
}
