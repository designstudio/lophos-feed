'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FeedViewSwitcher, usePreferredFeedView } from '@/components/FeedViewSwitcher'
import { IconLists } from '@/components/icons'
import { TopicIcon } from '@/components/TopicIcon'
import { EditorialListCardReactions } from './EditorialListCardReactions'
import { EditorialListShowcaseCard } from './EditorialListShowcaseCard'
import type { EditorialListCardItem } from '@/lib/editorial-list-card'
import { clerkImageUrl, imageProxySrcSet, imageProxyUrl } from '@/lib/image-url'

const CATALOG_IMAGE_WIDTHS = [320, 480, 640] as const

export type EditorialListCatalogItem = EditorialListCardItem
type ListReaction = 'like' | 'dislike'

function capitalize(value: string) {
  const normalized = value.trim()
  return normalized ? normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1) : normalized
}

function PublicationMeta({ list }: { list: EditorialListCatalogItem }) {
  return (
    <div className="lists-catalog-meta">
      {list.author_image_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={clerkImageUrl(list.author_image_url, 64)} alt="" loading="lazy" decoding="async" />
        : <span className="lists-catalog-meta__avatar" aria-hidden="true" />}
      <span>{list.author_name}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={list.published_at}>{formatDistanceToNow(new Date(list.published_at), { addSuffix: true, locale: ptBR })}</time>
    </div>
  )
}

function MosaicLists({ lists, reactions, onReactionChange }: {
  lists: EditorialListCatalogItem[]
  reactions: Record<string, ListReaction>
  onReactionChange: (id: string, reaction: ListReaction | null) => void
}) {
  const blocks: Array<{ columns: EditorialListCatalogItem[][]; reversed: boolean }> = []

  for (let index = 0; index < lists.length; index += 5) {
    const block = lists.slice(index, index + 5)
    const reversed = blocks.length % 2 === 1
    blocks.push({
      reversed,
      columns: reversed
        ? [[block[0], block[1]], [block[2], block[3]], [block[4]]]
        : [[block[0]], [block[1], block[2]], [block[3], block[4]]],
    })
  }

  return (
    <div className="editorial-list-showcase-blocks">
      {blocks.map(({ columns, reversed }, blockIndex) => (
        <div
          className={`editorial-list-showcase-grid${reversed ? ' editorial-list-showcase-grid--reversed' : ''}`}
          key={columns.flat()[0]?.id || blockIndex}
        >
          {columns.map((column, columnIndex) => (
            <div className="editorial-list-showcase-column" key={columnIndex}>
              {column.filter(Boolean).map((list, cardIndex) => (
                <EditorialListShowcaseCard
                  key={list.id}
                  list={list}
                  animationIndex={blockIndex * 5 + columnIndex * 2 + cardIndex}
                  variant={((!reversed && columnIndex === 0) || (reversed && columnIndex === 2)) && cardIndex === 0 ? 'feature' : 'media'}
                  initialReaction={reactions[list.id] ?? null}
                  onReactionChange={onReactionChange}
                  priority={blockIndex === 0 && columnIndex === 0 && cardIndex === 0}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ListCard({ list, animationIndex, initialReaction, onReactionChange }: {
  list: EditorialListCatalogItem
  animationIndex: number
  initialReaction: ListReaction | null
  onReactionChange: (id: string, reaction: ListReaction | null) => void
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: reduceMotion ? 0 : Math.min(animationIndex, 7) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="lists-catalog-row-shell">
        <Link href={`/lists/${list.slug}`} className="lists-catalog-row">
          {list.cover_image_url ? (
            <div className="lists-catalog-row__image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageProxyUrl(list.cover_image_url, 640)}
                srcSet={imageProxySrcSet(list.cover_image_url, CATALOG_IMAGE_WIDTHS)}
                sizes="(max-width: 767px) 100vw, 13rem"
                alt={list.cover_image_alt || ''}
                loading={animationIndex === 0 ? 'eager' : 'lazy'}
                fetchPriority={animationIndex === 0 ? 'high' : 'auto'}
                decoding="async"
              />
            </div>
          ) : <div className="lists-catalog-row__image lists-catalog-row__image--empty"><IconLists size={24} /></div>}
          <div className="lists-catalog-row__content">
            <div className="category-topic-pill">
              <TopicIcon topic={list.topic} />
              <span>{capitalize(list.topic)}</span>
            </div>
            <h2>{list.title}</h2>
            {list.seo_description ? <p>{list.seo_description}</p> : null}
            <PublicationMeta list={list} />
          </div>
        </Link>
        <div className="lists-catalog-row__actions">
          <EditorialListCardReactions
            listId={list.id}
            initialReaction={initialReaction}
            onReactionChange={onReactionChange}
          />
        </div>
      </div>
    </motion.article>
  )
}

export function EditorialListsCatalog({ lists, initialReactions = {} }: {
  lists: EditorialListCatalogItem[]
  initialReactions?: Record<string, ListReaction>
}) {
  const view = usePreferredFeedView()
  const [reactions, setReactions] = useState<Record<string, ListReaction>>(initialReactions)

  useEffect(() => setReactions(initialReactions), [initialReactions])

  const handleReactionChange = (id: string, reaction: ListReaction | null) => {
    setReactions((current) => {
      const next = { ...current }
      if (reaction) next[id] = reaction
      else delete next[id]
      return next
    })
  }

  return (
    <div className="editorial-page-scroll">
      <header className="favorites-view-header">
        <div className="favorites-view-header__title"><h1>Listas</h1></div>
        <FeedViewSwitcher current={view} ariaLabel="Visualização das listas" />
      </header>

      <main className={view === 'mosaic' ? 'mosaic-feed-page' : 'editorial-feed-layout'}>
        {lists.length === 0 ? (
          <div className="mosaic-feed-message" role="status">
            <IconLists size={40} className="opacity-40" />
            <div>
              <p className="text-[15px] font-medium">Nenhuma lista publicada ainda</p>
              <p className="mt-1 text-[13px] text-ink-tertiary">As listas editoriais aparecerão aqui quando forem publicadas.</p>
            </div>
          </div>
        ) : view === 'mosaic' ? (
          <MosaicLists lists={lists} reactions={reactions} onReactionChange={handleReactionChange} />
        ) : (
          <div className="lists-catalog-list">
            {lists.map((list, index) => (
              <ListCard
                key={list.id}
                list={list}
                animationIndex={index}
                initialReaction={reactions[list.id] ?? null}
                onReactionChange={handleReactionChange}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
