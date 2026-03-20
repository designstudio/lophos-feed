'use client'
import { createContext, useContext, useState, useCallback } from 'react'

interface FeedContextType {
  refreshing: boolean
  setRefreshing: (v: boolean) => void
  triggerRefresh: () => void
  onRefreshCallback: React.MutableRefObject<(() => void) | null>
}

const FeedContext = createContext<FeedContextType | null>(null)

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefreshCallback = { current: null } as React.MutableRefObject<(() => void) | null>

  const triggerRefresh = useCallback(() => {
    onRefreshCallback.current?.()
  }, [])

  return (
    <FeedContext.Provider value={{ refreshing, setRefreshing, triggerRefresh, onRefreshCallback }}>
      {children}
    </FeedContext.Provider>
  )
}

export function useFeedContext() {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeedContext must be used within FeedProvider')
  return ctx
}
