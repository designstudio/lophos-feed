'use client'

import { useEffect, useState } from 'react'
import type { EditorialListCardItem } from '@/lib/editorial-list-card'

export function useRelevantEditorialLists(activeTopic: string | null) {
  const [items, setItems] = useState<EditorialListCardItem[]>([])
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike'>>({})

  useEffect(() => {
    const controller = new AbortController()
    const query = activeTopic ? `?topic=${encodeURIComponent(activeTopic)}` : ''
    fetch(`/api/editorial-lists/feed${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return
        setItems(Array.isArray(data.items) ? data.items : [])
        setReactions(data.reactions ?? {})
      })
      .catch((error) => { if (error?.name !== 'AbortError') setItems([]) })
    return () => controller.abort()
  }, [activeTopic])

  const onReactionChange = (id: string, reaction: 'like' | 'dislike' | null) => {
    setReactions((current) => {
      const next = { ...current }
      if (reaction) next[id] = reaction
      else delete next[id]
      return next
    })
    if (reaction === 'dislike') setItems((current) => current.filter((item) => item.id !== id))
  }

  return { items, reactions, onReactionChange }
}
