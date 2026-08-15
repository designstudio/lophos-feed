'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, ThumbsDown } from '@untitledui/icons'
import { FeedItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { IconHeartFilled } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'

const LAZY_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif']

function proxyImage(url: string | undefined): string | undefined {
  if (!url || LAZY_PATTERNS.some((pattern) => url.toLowerCase().includes(pattern))) return undefined
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

function publishedLabel(publishedAt?: string): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function sourceInitials(name?: string) {
  return (name || 'Lophos')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function CoverageRail({ item }: { item: FeedItem }) {
  const rawImages = (item.coverageImages || [])
    .map((image) => proxyImage(image))
    .filter((image): image is string => Boolean(image))

  const coverage = rawImages
    .filter((image, index, images) => images.indexOf(image) === index)
    .slice(0, 4)

  if (coverage.length === 0) {
    const mainImage = proxyImage(item.imageUrl)
    if (mainImage) coverage.push(mainImage)
  }

  return (
    <div className="editorial-card__coverage" aria-hidden="true">
      <div className={cn('editorial-card__coverage-track', coverage.length === 1 && 'is-solo')}>
        {(coverage.length > 0 ? coverage : [null]).map((image, index) => (
          <div className="editorial-card__coverage-item" key={image || `fallback-${index}`}>
            <div className="editorial-card__coverage-media">
              <div className="editorial-card__coverage-fallback" />
              {image && (
                <img
                  src={image}
                  alt=""
                  className="editorial-card__coverage-image"
                  onError={(event) => { event.currentTarget.style.display = 'none' }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceAttribution({ sources }: { sources: FeedItem['sources'] }) {
  const shown = (sources || []).slice(0, 4)
  const total = (sources || []).length

  return (
    <div className="editorial-card__sources" aria-label={`${total} ${total === 1 ? 'fonte' : 'fontes'}`}>
      <div className="flex items-center" aria-hidden="true">
        {shown.map((source, index) => (
          <div
            key={`${source.url}-${index}`}
            className="editorial-card__source-avatar"
            style={{ marginLeft: index === 0 ? 0 : '-5px', zIndex: shown.length - index }}
          >
            <span>{sourceInitials(source.name)}</span>
            {source.favicon && (
              <img
                src={source.favicon}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
        ))}
      </div>
      <span>{total} {total === 1 ? 'fonte' : 'fontes'}</span>
    </div>
  )
}

interface Props {
  item: FeedItem
  variant?: 'full-left' | 'full-right' | 'card'
  className?: string
  initialReaction?: 'like' | 'dislike' | null
  fadingOut?: boolean
  solo?: boolean
  onReactionChange?: (articleId: string, reaction: 'like' | 'dislike' | null) => void
}

export function NewsCard({
  item,
  className,
  initialReaction = null,
  fadingOut = false,
  onReactionChange,
}: Props) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(initialReaction)
  const [reacting, setReacting] = useState(false)
  const dateLabel = publishedLabel(item.publishedAt)

  useEffect(() => setReaction(initialReaction), [initialReaction])

  const react = async (type: 'like' | 'dislike') => {
    if (reacting) return
    const previous = reaction
    const next = reaction === type ? null : type
    setReacting(true)
    setReaction(next)
    onReactionChange?.(item.id, next)

    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: item.id, topic: item.topic, reaction: next }),
      })
    } catch {
      setReaction(previous)
      onReactionChange?.(item.id, previous)
    } finally {
      setReacting(false)
    }
  }

  return (
    <article
      className={cn('editorial-card group', fadingOut && 'pointer-events-none opacity-0', className)}
    >
      <Link
        href={`/article/${item.id}`}
        aria-label={item.title}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-4"
      >
        <span className="sr-only">{item.title}</span>
      </Link>

      <CoverageRail item={item} />

      <div className="editorial-card__body">
        <div className="editorial-card__eyebrow">
          <span className="editorial-card__topic">{item.displayTopic ?? item.topic}</span>
          {dateLabel && <><i aria-hidden="true" /> <span className="editorial-card__date">{dateLabel}</span></>}
        </div>

        <h2>{item.title}</h2>
        <p className="editorial-card__summary">{item.summary}</p>

        <div className="editorial-card__footer">
          <SourceAttribution sources={item.sources} />
          <div className="editorial-card__reactions">
            <Tooltip content={reaction === 'like' ? 'Remover dos favoritos' : 'Salvar nos favoritos'} side="top">
              <motion.button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); void react('like') }}
                whileTap={{ scale: 0.85 }}
                disabled={reacting}
                className={cn('editorial-card__reaction editorial-card__reaction--like', reaction === 'like' && 'is-active')}
                aria-label={reaction === 'like' ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                aria-pressed={reaction === 'like'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={reaction === 'like' ? 'filled' : 'outline'}
                    initial={{ opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="flex"
                  >
                    {reaction === 'like' ? <IconHeartFilled size={20} /> : <Heart size={20} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </Tooltip>

            <Tooltip content="Não tenho interesse" side="top">
              <motion.button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); void react('dislike') }}
                whileTap={{ scale: 0.85 }}
                disabled={reacting}
                className={cn('editorial-card__reaction editorial-card__reaction--dislike', reaction === 'dislike' && 'is-active')}
                aria-label="Não tenho interesse"
                aria-pressed={reaction === 'dislike'}
              >
                <ThumbsDown size={20} />
              </motion.button>
            </Tooltip>
          </div>
        </div>
      </div>
    </article>
  )
}
