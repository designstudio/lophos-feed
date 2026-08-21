'use client'

import { usePreferredFeedView } from '@/components/FeedViewSwitcher'
import ListFeedView from '@/components/feed/ListFeedView'
import MosaicFeedView from '@/components/feed/MosaicFeedView'

export function FeedPage() {
  const view = usePreferredFeedView()
  return view === 'list' ? <ListFeedView /> : <MosaicFeedView />
}
