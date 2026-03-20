'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewsItem } from '@/lib/types'
import { Like, Dislike } from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'

interface Props {
  item: NewsItem
  // 'full-left'  = texto esquerda, imagem direita (padrão Perplexity linha 1 e 4)
  // 'full-right' = imagem esquerda, texto direita (padrão Perplexity linha 4)
  // 'card'       = card compacto para grid de 3
  variant?: 'full-left' | 'full-right' | 'card'
  className?: string
}

function Sources({ sources }: { sources: NewsItem['sources'] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      {sources.slice(0, 4).map((src, i) => (
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
      {sources.length > 4 && (
        <span className="text-[11px] text-ink-muted px-1">+{sources.length - 4}</span>
      )}
    </div>
  )
}

function Reactions({ reaction, onReact }: { reaction: 'like' | 'dislike' | null; onReact: (t: 'like' | 'dislike') => void }) {
  return (
    <div className="flex items-center gap-1 mt-2.5">
      <button
        onClick={() => onReact('like')}
        className={cn(
          'reaction-btn flex items-center px-2 py-1 rounded-full text-[11px] transition-all',
          reaction === 'like' ? 'bg-green-50 text-green-600' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
        )}
      >
        <Like size={12} />
      </button>
      <button
        onClick={() => onReact('dislike')}
        className={cn(
          'reaction-btn flex items-center px-2 py-1 rounded-full text-[11px] transition-all',
          reaction === 'dislike' ? 'bg-red-50 text-red-500' : 'text-ink-muted hover:text-ink-secondary hover:bg-bg-secondary'
        )}
      >
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

  // Card compacto — grid de 3
  if (variant === 'card') {
    return (
      <article onClick={handleClick} className={cn('cursor-pointer group flex flex-col', className)}>
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1">{item.topic}</span>
        <h2 className="text-[14px] font-semibold text-ink-primary group-hover:text-accent transition-colors leading-snug">
          {item.title}
        </h2>
        {item.imageUrl && (
          <div className="mt-2.5 w-full h-36 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
        <Sources sources={item.sources} />
        <Reactions reaction={reaction} onReact={react} />
      </article>
    )
  }

  // Full com imagem — texto à esquerda, imagem à direita
  if (variant === 'full-left') {
    return (
      <article onClick={handleClick} className={cn('cursor-pointer group flex gap-6 items-start', className)}>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
          <h2 className="text-[20px] font-semibold text-ink-primary group-hover:text-accent transition-colors leading-snug mt-1">
            {item.title}
          </h2>
          <p className="text-ink-secondary text-[13px] leading-relaxed mt-2 line-clamp-3">{item.summary}</p>
          <Sources sources={item.sources} />
          <Reactions reaction={reaction} onReact={react} />
        </div>
        {item.imageUrl && (
          <div className="flex-shrink-0 w-48 h-32 rounded-xl overflow-hidden bg-bg-secondary">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
          </div>
        )}
      </article>
    )
  }

  // Full com imagem — imagem à esquerda, texto à direita
  return (
    <article onClick={handleClick} className={cn('cursor-pointer group flex gap-6 items-start', className)}>
      {item.imageUrl && (
        <div className="flex-shrink-0 w-48 h-32 rounded-xl overflow-hidden bg-bg-secondary">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
        <h2 className="text-[20px] font-semibold text-ink-primary group-hover:text-accent transition-colors leading-snug mt-1">
          {item.title}
        </h2>
        <p className="text-ink-secondary text-[13px] leading-relaxed mt-2 line-clamp-3">{item.summary}</p>
        <Sources sources={item.sources} />
        <Reactions reaction={reaction} onReact={react} />
      </div>
    </article>
  )
}
