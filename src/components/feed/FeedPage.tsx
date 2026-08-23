'use client'

import dynamic from 'next/dynamic'
import { usePreferredFeedView } from '@/components/FeedViewSwitcher'

const ListFeedView = dynamic(() => import('@/components/feed/ListFeedView'))
const MosaicFeedView = dynamic(() => import('@/components/feed/MosaicFeedView'))

export function FeedPage() {
  const view = usePreferredFeedView()
  return view === 'list' ? <ListFeedView /> : <MosaicFeedView />
}
