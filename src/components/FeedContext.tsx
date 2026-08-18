'use client'
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { FeedItem } from '@/lib/types'

interface FeedContextType {
  refreshing: boolean
  setRefreshing: (v: boolean) => void
  updatesReady: boolean
  setUpdatesReady: (v: boolean) => void
  pendingFeedItems: FeedItem[]
  setPendingFeedItems: React.Dispatch<React.SetStateAction<FeedItem[]>>
  triggerRefresh: () => void
  onRefreshCallback: React.MutableRefObject<(() => void) | null>
  triggerApplyUpdates: () => void
  onApplyUpdatesCallback: React.MutableRefObject<(() => void) | null>
}

const FeedContext = createContext<FeedContextType | null>(null)

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [refreshing, setRefreshing] = useState(false)
  const [updatesReady, setUpdatesReady] = useState(false)
  const [pendingFeedItems, setPendingFeedItems] = useState<FeedItem[]>([])
  const onRefreshCallback = useRef<(() => void) | null>(null)
  const onApplyUpdatesCallback = useRef<(() => void) | null>(null)

  const triggerRefresh = useCallback(() => {
    onRefreshCallback.current?.()
  }, [])

  const triggerApplyUpdates = useCallback(() => {
    onApplyUpdatesCallback.current?.()
  }, [])

  return (
    <FeedContext.Provider value={{
      refreshing,
      setRefreshing,
      updatesReady,
      setUpdatesReady,
      pendingFeedItems,
      setPendingFeedItems,
      triggerRefresh,
      onRefreshCallback,
      triggerApplyUpdates,
      onApplyUpdatesCallback,
    }}>
      {children}
    </FeedContext.Provider>
  )
}

export function useFeedContext() {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeedContext must be used within FeedProvider')
  return ctx
}
