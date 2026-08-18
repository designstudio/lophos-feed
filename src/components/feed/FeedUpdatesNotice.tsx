'use client'

import { RefreshCcw05 } from '@untitledui/icons'
import { useFeedContext } from '@/components/FeedContext'
import { cn } from '@/lib/utils'

export function FeedUpdatesNotice() {
  const { updatesReady, triggerApplyUpdates } = useFeedContext()

  return (
    <div
      className={cn('feed-updates-notice', updatesReady && 'is-open')}
      aria-live="polite"
    >
      <button
        type="button"
        className={cn('feed-updates-notice__button t-toast', updatesReady && 'is-open')}
        aria-hidden={!updatesReady}
        tabIndex={updatesReady ? 0 : -1}
        onClick={triggerApplyUpdates}
      >
        <RefreshCcw05 size={16} aria-hidden="true" />
        <span>Seu feed tem novas notícias</span>
      </button>
    </div>
  )
}
