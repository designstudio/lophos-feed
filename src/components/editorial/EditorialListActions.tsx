'use client'

import { useAuth } from '@clerk/nextjs'
import { Copy06 as Copy, Flag06 as ReportFlag, Share07 as Share, ThumbsDown as Dislike } from '@untitledui/icons'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArticleReportModal } from '@/components/ArticleReportModal'
import { LikeBurstIcon } from '@/components/LikeBurstIcon'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'

type ListReaction = 'like' | 'dislike' | null

interface EditorialListActionsProps {
  listId: string
  slug: string
  title: string
  text: string
}

export function EditorialListActions({ listId, slug, title, text }: EditorialListActionsProps) {
  const { isSignedIn } = useAuth()
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [likeBurstToken, setLikeBurstToken] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const desiredReactionRef = useRef<ListReaction>(null)
  const persistedReactionRef = useRef<ListReaction>(null)
  const reactionSavingRef = useRef(false)
  const reactionReadyRef = useRef(false)
  const reactionChangedRef = useRef(false)

  const applyReactionState = useCallback((reaction: ListReaction) => {
    setLiked(reaction === 'like')
    setDisliked(reaction === 'dislike')
  }, [])

  const flushReactionQueue = useCallback(async () => {
    if (!reactionReadyRef.current || reactionSavingRef.current) return
    reactionSavingRef.current = true
    try {
      while (persistedReactionRef.current !== desiredReactionRef.current) {
        const reaction = desiredReactionRef.current
        const response = await fetch('/api/list-reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId, reaction }),
        })
        if (!response.ok) throw new Error('Failed to update reaction')
        persistedReactionRef.current = reaction
      }
    } catch {
      desiredReactionRef.current = persistedReactionRef.current
      applyReactionState(persistedReactionRef.current)
    } finally {
      reactionSavingRef.current = false
      if (persistedReactionRef.current !== desiredReactionRef.current) void flushReactionQueue()
    }
  }, [applyReactionState, listId])

  useEffect(() => {
    desiredReactionRef.current = null
    persistedReactionRef.current = null
    reactionReadyRef.current = false
    reactionChangedRef.current = false
    applyReactionState(null)
    if (!isSignedIn) return

    const controller = new AbortController()
    fetch('/api/list-reactions', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load reactions')
        return response.json()
      })
      .then((data) => {
        const reaction = ((data.reactions ?? {})[listId] ?? null) as ListReaction
        persistedReactionRef.current = reaction
        reactionReadyRef.current = true
        if (reactionChangedRef.current) void flushReactionQueue()
        else {
          desiredReactionRef.current = reaction
          applyReactionState(reaction)
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
        reactionReadyRef.current = true
        if (reactionChangedRef.current) void flushReactionQueue()
      })
    return () => controller.abort()
  }, [applyReactionState, flushReactionQueue, isSignedIn, listId])

  const updateReaction = (reaction: ListReaction) => {
    if (!isSignedIn) return
    reactionChangedRef.current = true
    desiredReactionRef.current = reaction
    if (reaction === 'like') setLikeBurstToken((token) => token + 1)
    applyReactionState(reaction)
    void flushReactionQueue()
  }

  const copyList = async () => {
    const url = `${window.location.origin}/lists/${slug}`
    const value = [title, text, `Leia no Lophos: ${url}`].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      if (navigator.share) await navigator.share({ title, text: value, url })
    }
  }

  const shareList = async () => {
    const url = `${window.location.origin}/lists/${slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // A dismissed share sheet falls back to copying the URL.
      }
    }
    await navigator.clipboard.writeText(url)
  }

  const reactionClass = 'flex h-8 w-8 items-center justify-center rounded-full transition-colors'

  return (
    <>
      <div className="mb-8 flex items-center gap-1.5" aria-label="Ações da lista">
        <Tooltip content={liked ? 'Descurtir' : 'Curtir'}>
          <motion.button
            type="button"
            onClick={() => updateReaction(liked ? null : 'like')}
            disabled={!isSignedIn}
            aria-label={liked ? 'Descurtir' : 'Curtir'}
            aria-pressed={liked}
            whileTap={{ scale: 0.85 }}
            className={cn('editorial-card__reaction--like', reactionClass, liked ? 'is-active' : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary', !isSignedIn && 'cursor-not-allowed opacity-60')}
          >
            <LikeBurstIcon liked={liked} burstToken={likeBurstToken} size={16} />
          </motion.button>
        </Tooltip>

        <Tooltip content={disliked ? 'Remover desinteresse' : 'Não tenho interesse'}>
          <motion.button
            type="button"
            onClick={() => updateReaction(disliked ? null : 'dislike')}
            disabled={!isSignedIn}
            aria-label={disliked ? 'Remover desinteresse' : 'Não tenho interesse'}
            aria-pressed={disliked}
            whileTap={{ scale: 0.85 }}
            className={cn(reactionClass, disliked ? 'bg-zinc-100 text-zinc-600' : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary', !isSignedIn && 'cursor-not-allowed opacity-60')}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={disliked ? 'filled' : 'outline'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }} className="flex">
                <Dislike size={16} />
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </Tooltip>

        <Tooltip content={copied ? 'Lista copiada' : 'Copiar lista'}>
          <motion.button type="button" onClick={copyList} aria-label={copied ? 'Lista copiada' : 'Copiar lista'} whileTap={{ scale: 0.85 }} className={cn(reactionClass, 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary')}>
            <Copy size={16} />
          </motion.button>
        </Tooltip>

        <Tooltip content="Compartilhar">
          <motion.button type="button" onClick={shareList} aria-label="Compartilhar lista" whileTap={{ scale: 0.85 }} className={cn(reactionClass, 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary')}>
            <Share size={16} />
          </motion.button>
        </Tooltip>

        <Tooltip content="Reportar um problema">
          <motion.button type="button" onClick={() => setShowReportModal(true)} disabled={!isSignedIn} aria-label="Reportar um problema nesta lista" whileTap={{ scale: 0.85 }} className={cn(reactionClass, 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary', !isSignedIn && 'cursor-not-allowed opacity-60')}>
            <ReportFlag size={16} />
          </motion.button>
        </Tooltip>
      </div>

      <ArticleReportModal articleId={listId} articleTitle={title} contentType="list" isOpen={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  )
}
