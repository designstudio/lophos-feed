'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewsItem } from '@/lib/types'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  item: NewsItem
  featured?: boolean
  className?: string
  style?: React.CSSProperties
}

export function NewsCard({ item, featured = false, className, style }: Props) {
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

  return (
    <article
      onClick={handleClick}
      className={cn('cursor-pointer group', featured ? 'flex gap-5' : 'flex flex-col', className)}
      style={style}
    >
      {/* Image — featured left side */}
      {featured && item.imageUrl && (
        <div className="flex-shrink-0 w-44 h-28 rounded-xl overflow-hidden bg-bg-secondary">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Topic tag */}
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">
          {item.topic}
        </span>

        {/* Title */}
        <h2 className={cn(
          'font-semibold text-ink-primary group-hover:text-accent transition-colors leading-snug mt-1',
          featured ? 'text-[17px]' : 'text-[14px]'
        )}>
          {item.title}
        </h2>

        {/* Summary — featured only */}
        {featured && (
          <p className="text-ink-secondary text-[13px] leading-relaxed mt-1.5 line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Sources — Perplexity style */}
        {item.sources && item.sources.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {item.sources.slice(0, 4).map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-secondary hover:bg-bg-tertiary transition-colors"
              >
                {src.favicon && (
                  <img
                    src={src.favicon}
                    alt=""
                    width={11}
                    height={11}
                    className="rounded-sm flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <span className="text-[11px] text-ink-tertiary font-medium">{src.name}</span>
              </a>
            ))}
            {item.sources.length > 4 && (
              <span className="text-[11px] text-ink-muted px-1">+{item.sources.length - 4}</span>
            )}
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1 mt-2.5">
          <button
            onClick={() => react('like')}
            className={cn(
              'reaction-btn flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all',
              reaction === 'like'
                ? 'bg-green-50 text-green-600'
                : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
            )}
          >
            <ThumbsUp size={11} />
          </button>
          <button
            onClick={() => react('dislike')}
            className={cn(
              'reaction-btn flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-all',
              reaction === 'dislike'
                ? 'bg-red-50 text-red-500'
                : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
            )}
          >
            <ThumbsDown size={11} />
          </button>
        </div>
      </div>

      {/* Thumbnail — non-featured cards */}
      {!featured && item.imageUrl && (
        <div className="mt-2 w-full h-32 rounded-lg overflow-hidden bg-bg-secondary">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
    </article>
  )
}
