'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  RefreshCw05 as Refresh,
  Heart as HeartAngle,
  SearchMd as Magnifer,
} from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { IconFeed } from '@/components/icons'
import { LophosLogo } from '@/components/LophosLogo'
import { SearchModal } from '@/components/SearchModal'
import { Tooltip } from '@/components/Tooltip'
import { startNavigationFeedback } from '@/components/NavigationFeedback'
import { CollapsedUserMenu } from './sidebar/CollapsedUserMenu'

interface Props {
  onRefresh?: () => void
  refreshing?: boolean
  refreshLabel?: string
  refreshTitle?: string
}

export function Sidebar({ onRefresh, refreshing, refreshLabel, refreshTitle }: Props) {
  const path = usePathname()
  const isFeedActive = path === '/feed'
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [userTopics, setUserTopics] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => setUserTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [])

  useEffect(() => setMounted(true), [])

  return (
    <div>
      <aside
        className="app-navigation-rail flex flex-shrink-0 flex-col overflow-hidden"
        data-collapsed="true"
        style={{
          width: '5rem',
          height: '100dvh',
        }}
      >
        <div className="mb-10 flex min-h-[4.75rem] flex-shrink-0 items-center justify-center pt-3">
          <LophosLogo size={48} />
        </div>

        <nav className="flex flex-col gap-2 flex-1 min-h-0 px-3">
          <Tooltip content="Meu feed" side="right" className="w-full">
            <Link
              href="/feed"
              aria-label="Meu feed"
              aria-current={isFeedActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                isFeedActive ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <IconFeed size={18} className="flex-shrink-0" />
            </Link>
          </Tooltip>

          <Tooltip content="Minhas curtidas" side="right" className="w-full">
            <Link
              href="/favorites"
              aria-label="Minhas curtidas"
              aria-current={path === '/favorites' ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                path === '/favorites' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <HeartAngle size={18} className="flex-shrink-0" />
            </Link>
          </Tooltip>

          <Tooltip content="Buscar" side="right" className="w-full">
            <button
              onClick={() => setShowSearch(true)}
              aria-label="Buscar"
              className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-secondary transition-colors hover:text-ink-primary hover:bg-bg-secondary"
            >
              <Magnifer size={18} className="flex-shrink-0" />
            </button>
          </Tooltip>

          {onRefresh && (
            <Tooltip content={refreshTitle ?? refreshLabel ?? 'Atualizar feed'} side="right" className="w-full">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                aria-label={refreshing ? 'Atualizando feed' : refreshLabel ?? 'Atualizar feed'}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm text-ink-secondary transition-colors hover:text-ink-primary hover:bg-bg-secondary disabled:opacity-50"
              >
                <Refresh size={18} className={cn('flex-shrink-0', refreshing ? 'animate-spin' : '')} />
              </button>
            </Tooltip>
          )}
        </nav>

        <div className="flex-shrink-0 px-3 pt-3 pb-5">
          <CollapsedUserMenu onOpenSettings={() => {
            startNavigationFeedback()
            router.push('/settings')
          }} />
        </div>
      </aside>

      {showSearch && mounted && createPortal(
        <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} userTopics={userTopics} />,
        document.body
      )}

    </div>
  )
}

export function SidebarWithRefresh() {
  const { refreshing, updatesReady, triggerApplyUpdates } = useFeedContext()
  return (
    <Sidebar
      onRefresh={updatesReady ? triggerApplyUpdates : undefined}
      refreshing={refreshing}
      refreshLabel="Seu feed tem novidades"
      refreshTitle="Ver novas notícias"
    />
  )
}
