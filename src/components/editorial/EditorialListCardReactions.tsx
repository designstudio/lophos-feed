'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ThumbsDown } from '@untitledui/icons'
import { LikeBurstIcon } from '@/components/LikeBurstIcon'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'
import { useAuth } from '@clerk/nextjs'
import { useAuthPrompt } from '@/components/auth/AuthPrompt'

export function EditorialListCardReactions({ listId, initialReaction, onReactionChange }: {
  listId: string
  initialReaction: 'like' | 'dislike' | null
  onReactionChange?: (id: string, reaction: 'like' | 'dislike' | null) => void
}) {
  const [reaction, setReaction] = useState(initialReaction)
  const [reacting, setReacting] = useState(false)
  const [burstToken, setBurstToken] = useState(0)
  const { isLoaded, isSignedIn } = useAuth()
  const { openAuthPrompt } = useAuthPrompt()
  const authGated = isLoaded && !isSignedIn

  useEffect(() => setReaction(initialReaction), [initialReaction])

  const react = async (type: 'like' | 'dislike') => {
    if (authGated) {
      openAuthPrompt('login')
      return
    }
    if (reacting) return
    const previous = reaction
    const next = reaction === type ? null : type
    setReaction(next)
    setReacting(true)
    if (next === 'like') setBurstToken((token) => token + 1)
    onReactionChange?.(listId, next)
    try {
      const response = await fetch('/api/list-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId, reaction: next }),
      })
      if (!response.ok) throw new Error('Failed to save reaction')
    } catch {
      setReaction(previous)
      onReactionChange?.(listId, previous)
    } finally {
      setReacting(false)
    }
  }

  return (
    <div className="editorial-card__reactions">
      <Tooltip content={authGated ? 'Entre para curtir' : reaction === 'like' ? 'Descurtir' : 'Curtir'} side="top">
        <motion.button
          type="button"
          onClick={() => { void react('like') }}
          whileTap={{ scale: 0.85 }}
          disabled={reacting}
          className={cn('editorial-card__reaction editorial-card__reaction--like', reaction === 'like' && 'is-active', authGated && 'opacity-45 grayscale')}
          aria-label={authGated ? 'Entrar para curtir' : reaction === 'like' ? 'Descurtir' : 'Curtir'}
          aria-pressed={reaction === 'like'}
        >
          <LikeBurstIcon liked={reaction === 'like'} burstToken={burstToken} size={20} />
        </motion.button>
      </Tooltip>
      <Tooltip content={authGated ? 'Entre para personalizar' : 'Não tenho interesse'} side="top">
        <motion.button
          type="button"
          onClick={() => { void react('dislike') }}
          whileTap={{ scale: 0.85 }}
          disabled={reacting}
          className={cn('editorial-card__reaction editorial-card__reaction--dislike', reaction === 'dislike' && 'is-active', authGated && 'opacity-45 grayscale')}
          aria-label={authGated ? 'Entrar para personalizar o feed' : 'Não tenho interesse'}
          aria-pressed={reaction === 'dislike'}
        >
          <ThumbsDown size={20} />
        </motion.button>
      </Tooltip>
    </div>
  )
}
