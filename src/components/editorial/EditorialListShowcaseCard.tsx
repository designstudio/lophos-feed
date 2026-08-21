'use client'

import Link from 'next/link'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { TopicIcon } from '@/components/TopicIcon'
import { IconLists } from '@/components/icons'
import { EditorialListCardReactions } from './EditorialListCardReactions'
import type { EditorialListCatalogItem } from './EditorialListsCatalog'

function capitalize(value: string) {
  const normalized = value.trim()
  return normalized ? normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1) : normalized
}

export function EditorialListShowcaseCard({ list, animationIndex, variant, label = 'topic', initialReaction = null, onReactionChange }: {
  list: EditorialListCatalogItem
  animationIndex: number
  variant: 'feature' | 'media'
  label?: 'topic' | 'editorial-list'
  initialReaction?: 'like' | 'dislike' | null
  onReactionChange?: (id: string, reaction: 'like' | 'dislike' | null) => void
}) {
  const reduceMotion = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const currentIndexRef = useRef(0)
  const geometryRef = useRef({ start: 0, step: 0 })
  const advanceRef = useRef<() => void>(() => {})

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const cssTime = useCallback((property: string, fallback: number) => {
    const track = trackRef.current
    if (!track) return fallback
    const raw = getComputedStyle(track).getPropertyValue(property).trim()
    const value = Number.parseFloat(raw)
    if (!Number.isFinite(value)) return fallback
    return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : fallback
  }, [])

  const showIndex = useCallback((index: number, animate = true, duration?: number) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animate
      ? duration
        ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : ''
      : 'none'
    const { start, step } = geometryRef.current
    track.style.transform = `translate3d(${start - index * step}px, 0, 0)`
    if (!animate) {
      void track.offsetWidth
      track.style.removeProperty('transition')
    }
  }, [])

  const measureTrack = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const tiles = track.querySelectorAll<HTMLElement>('.editorial-list-showcase-card__image')
    const first = tiles[0]
    if (!first) return
    const step = tiles[1] ? tiles[1].offsetLeft - first.offsetLeft : first.offsetWidth
    geometryRef.current = {
      start: (viewport.clientWidth - first.offsetWidth) / 2 - first.offsetLeft,
      step,
    }
    currentIndexRef.current = 0
    showIndex(0, false)
    track.style.opacity = '1'
  }, [showIndex])

  const scheduleNext = useCallback((delay: number) => {
    clearTimer()
    timerRef.current = window.setTimeout(() => advanceRef.current(), delay)
  }, [clearTimer])

  const images = list.gallery_images.length > 0 ? list.gallery_images : list.cover_image_url ? [list.cover_image_url] : []
  advanceRef.current = () => {
    if (!activeRef.current || images.length <= 1) return
    const moveDuration = cssTime('--showcase-move-duration', 420)
    const pauseDuration = cssTime('--showcase-pause-duration', 700)
    if (currentIndexRef.current === images.length - 1) {
      const returnDuration = cssTime('--showcase-return-duration', 900)
      currentIndexRef.current = 0
      showIndex(0, true, returnDuration)
      scheduleNext(returnDuration + pauseDuration)
      return
    }

    const nextIndex = currentIndexRef.current + 1
    currentIndexRef.current = nextIndex
    showIndex(nextIndex)
    scheduleNext(moveDuration + pauseDuration)
  }

  const startCarousel = (pointerType?: string) => {
    if (pointerType === 'touch' || reduceMotion || images.length <= 1) return
    activeRef.current = true
    currentIndexRef.current = 0
    showIndex(0, false)
    scheduleNext(cssTime('--showcase-pause-duration', 700))
  }

  const stopCarousel = () => {
    activeRef.current = false
    clearTimer()
    currentIndexRef.current = 0
    showIndex(0)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(measureTrack)
    observer.observe(viewport)
    const frame = window.requestAnimationFrame(measureTrack)
    return () => {
      activeRef.current = false
      clearTimer()
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [clearTimer, measureTrack])

  return (
    <motion.article
      className={`editorial-list-showcase-card editorial-list-showcase-card--${variant}${label === 'editorial-list' ? ' mosaic-story' : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : Math.min(animationIndex, 7) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="category-topic-pill editorial-list-showcase-card__category">
        {label === 'editorial-list' ? <IconLists size={11} /> : <TopicIcon topic={list.topic} />}
        <span>{label === 'editorial-list' ? 'Lista editorial' : capitalize(list.topic)}</span>
      </div>
      <Link
        href={`/lists/${list.slug}`}
        className="editorial-list-showcase-card__link"
        onPointerEnter={(event) => startCarousel(event.pointerType)}
        onPointerLeave={stopCarousel}
        onFocus={() => startCarousel()}
        onBlur={stopCarousel}
      >
        {variant === 'feature' ? <h2>{list.title}</h2> : null}
        <div ref={viewportRef} className="editorial-list-showcase-card__viewport">
          {images.length > 0 ? (
            <div ref={trackRef} className="editorial-list-showcase-card__track" aria-hidden="true">
              {images.map((image, index) => (
                <div
                  className="editorial-list-showcase-card__image"
                  data-position={index % 4}
                  key={`${image}-${index}`}
                >
                  {/* Images form a decorative preview; the title labels the destination. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/image-proxy?url=${encodeURIComponent(image)}`}
                    alt=""
                    onLoad={measureTrack}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="editorial-list-showcase-card__empty" aria-hidden="true">
              <span /><span /><span />
            </div>
          )}
        </div>
        {variant !== 'feature' ? <h2>{list.title}</h2> : null}
        {variant === 'feature' && list.seo_description ? (
          <p className="editorial-list-showcase-card__summary">{list.seo_description}</p>
        ) : null}
      </Link>
      <div className="editorial-list-showcase-card__footer">
        <div className="editorial-list-showcase-card__meta">
          {list.author_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={list.author_image_url} alt="" />
          ) : <span className="editorial-list-showcase-card__avatar" aria-hidden="true" />}
          <span>Por {list.author_name}</span>
        </div>
        {onReactionChange ? (
          <EditorialListCardReactions listId={list.id} initialReaction={initialReaction} onReactionChange={onReactionChange} />
        ) : null}
      </div>
    </motion.article>
  )
}
