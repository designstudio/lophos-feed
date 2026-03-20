'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { NewsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  item: NewsItem
  featured?: boolean
  className?: string
  style?: React.CSSProperties
}

export function NewsCard({ item, featured = false, className, style }: Props) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/article/${item.id}`)
  }

  return (
    <article
      onClick={handleClick}
      className={cn(
        'cursor-pointer group',
        featured ? 'flex gap-5' : 'flex flex-col',
        className
      )}
      style={style}
    >
      {/* Image — only for featured */}
      {featured && item.imageUrl && (
        <div className="flex-shrink-0 w-48 h-32 rounded-xl overflow-hidden bg-bg-secondary">
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
        <span className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wider">
          {item.topic}
        </span>

        {/* Title */}
        <h2
          className={cn(
            'font-display text-ink-primary group-hover:text-accent transition-colors leading-snug mt-1',
            featured ? 'text-xl' : 'text-base'
          )}
        >
          {item.title}
        </h2>

        {/* Summary — only for featured */}
        {featured && (
          <p className="text-ink-secondary text-sm leading-relaxed mt-1.5 line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Sources */}
        {item.sources && item.sources.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {item.sources.slice(0, 4).map((src, i) => (
              <div
                key={i}
                className="flex items-center gap-1 text-[11px] text-ink-tertiary"
              >
                {src.favicon && (
                  <img
                    src={src.favicon}
                    alt=""
                    width={12}
                    height={12}
                    className="rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <span>{src.name}</span>
                {i < Math.min(item.sources.length, 4) - 1 && (
                  <span className="text-ink-muted">·</span>
                )}
              </div>
            ))}
            {item.sources.length > 4 && (
              <span className="text-[11px] text-ink-muted">
                +{item.sources.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thumbnail — for non-featured cards */}
      {!featured && item.imageUrl && (
        <div className="mt-2 w-full h-36 rounded-lg overflow-hidden bg-bg-secondary">
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
