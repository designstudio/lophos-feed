'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFeedContext } from '@/components/FeedContext'
import type { FeedItem } from '@/lib/types'

const FEED_UPDATES_POLL_MS = 6 * 60 * 60 * 1000

type UseFeedUpdatesOptions = {
  items: FeedItem[]
  topics: string[]
  onApplyUpdates: (items: FeedItem[]) => void
}

function mergeUpdates(current: FeedItem[], incoming: FeedItem[]) {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return Array.from(byId.values())
}

export function useFeedUpdates({ items, topics, onApplyUpdates }: UseFeedUpdatesOptions) {
  const {
    setUpdatesReady,
    pendingFeedItems,
    setPendingFeedItems,
    onApplyUpdatesCallback,
  } = useFeedContext()
  const itemsRef = useRef(items)
  const topicsRef = useRef(topics)
  const pendingRef = useRef(pendingFeedItems)
  const onApplyRef = useRef(onApplyUpdates)
  const checkingRef = useRef(false)
  const topicsKey = [...topics].sort().join('|')
  const previousTopicsKeyRef = useRef(topicsKey)

  itemsRef.current = items
  topicsRef.current = topics
  pendingRef.current = pendingFeedItems
  onApplyRef.current = onApplyUpdates

  useEffect(() => {
    if (previousTopicsKeyRef.current === topicsKey) return
    previousTopicsKeyRef.current = topicsKey
    setPendingFeedItems([])
    setUpdatesReady(false)
  }, [setPendingFeedItems, setUpdatesReady, topicsKey])

  const checkForUpdates = useCallback(async () => {
    if (checkingRef.current || document.visibilityState === 'hidden') return
    const currentItems = itemsRef.current
    const currentTopics = topicsRef.current
    if (currentItems.length === 0 || currentTopics.length === 0) return

    const newest = currentItems.reduce((latest, item) => {
      const itemTime = new Date(item.cachedAt ?? item.publishedAt ?? 0).getTime()
      const latestTime = new Date(latest.cachedAt ?? latest.publishedAt ?? 0).getTime()
      return itemTime > latestTime ? item : latest
    })
    const since = newest.cachedAt ?? newest.publishedAt
    if (!since) return

    checkingRef.current = true
    try {
      const response = await fetch('/api/feed/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since, topics: currentTopics }),
      })
      if (!response.ok) return

      const data = await response.json()
      if (!data.hasUpdates || !Array.isArray(data.items)) return

      const knownIds = new Set([
        ...currentItems.map((item) => item.id),
        ...pendingRef.current.map((item) => item.id),
      ])
      const unseenItems = (data.items as FeedItem[]).filter((item) => !knownIds.has(item.id))
      if (unseenItems.length === 0) return

      setPendingFeedItems((current) => mergeUpdates(current, unseenItems))
      setUpdatesReady(true)
    } catch {
      // The feed stays usable when a background availability check fails.
    } finally {
      checkingRef.current = false
    }
  }, [setPendingFeedItems, setUpdatesReady])

  useEffect(() => {
    onApplyUpdatesCallback.current = () => {
      const updates = pendingRef.current
      if (updates.length === 0) return
      onApplyRef.current(updates)
      setPendingFeedItems([])
      setUpdatesReady(false)
    }

    return () => {
      onApplyUpdatesCallback.current = null
    }
  }, [onApplyUpdatesCallback, setPendingFeedItems, setUpdatesReady])

  useEffect(() => {
    const initialCheck = window.setTimeout(() => { void checkForUpdates() }, 1500)
    const interval = window.setInterval(() => { void checkForUpdates() }, FEED_UPDATES_POLL_MS)
    const checkWhenActive = () => {
      if (document.visibilityState === 'visible') void checkForUpdates()
    }

    window.addEventListener('focus', checkWhenActive)
    document.addEventListener('visibilitychange', checkWhenActive)
    return () => {
      window.clearTimeout(initialCheck)
      window.clearInterval(interval)
      window.removeEventListener('focus', checkWhenActive)
      document.removeEventListener('visibilitychange', checkWhenActive)
    }
  }, [checkForUpdates])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return

    const showTestNotice = () => {
      const previewItem = itemsRef.current[0]
      if (!previewItem) return

      setPendingFeedItems([previewItem])
      setUpdatesReady(true)
    }

    window.addEventListener('lophos:test-feed-update', showTestNotice)
    return () => window.removeEventListener('lophos:test-feed-update', showTestNotice)
  }, [setPendingFeedItems, setUpdatesReady])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || items.length === 0) return

    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('test-feed-update') !== '1') return

    searchParams.delete('test-feed-update')
    const nextSearch = searchParams.toString()
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
    )
    setPendingFeedItems([items[0]])
    setUpdatesReady(true)
  }, [items, setPendingFeedItems, setUpdatesReady])
}
