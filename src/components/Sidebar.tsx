'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  RefreshCw05 as Refresh,
  Heart as HeartAngle,
  SearchMd as Magnifer,
} from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { IconFeed, IconLists } from '@/components/icons'
import { LophosLogo } from '@/components/LophosLogo'
import { Tooltip } from '@/components/Tooltip'
import { startNavigationFeedback } from '@/components/NavigationFeedback'
import { CollapsedUserMenu } from './sidebar/CollapsedUserMenu'
import { useAuthPrompt } from '@/components/auth/AuthPrompt'
import { useHydrated } from '@/hooks/useHydrated'

const SearchModal = dynamic(
  () => import('@/components/SearchModal').then((module) => module.SearchModal),
  { ssr: false },
)

interface Props {
  onRefresh?: () => void
  refreshing?: boolean
  refreshLabel?: string
  refreshTitle?: string
}

export function Sidebar({ onRefresh, refreshing, refreshLabel, refreshTitle }: Props) {
  const path = usePathname()
  const { sessionClaims, isSignedIn } = useAuth()
  const hydrated = useHydrated()
  const signedIn = hydrated && Boolean(isSignedIn)
  const { openAuthPrompt } = useAuthPrompt()
  const isAdmin = signedIn && sessionClaims?.metadata?.role === 'admin'
  const isFeedActive = path === '/' || path === '/feed'
  const isListsActive = path === '/lists' || path.startsWith('/lists/')
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)
  const [userTopics, setUserTopics] = useState<string[]>([])

  useEffect(() => {
    if (!signedIn || !showSearch || userTopics.length > 0) return
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => setUserTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [showSearch, signedIn, userTopics.length])

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
          <Tooltip content={signedIn ? 'Meu feed' : 'Feed'} side="right" className="w-full">
            <Link
              href="/"
              aria-label={signedIn ? 'Meu feed' : 'Feed'}
              aria-current={isFeedActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                isFeedActive ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <IconFeed size={18} className="flex-shrink-0" />
            </Link>
          </Tooltip>

          <Tooltip content="Listas" side="right" className="w-full">
            <Link
              href="/lists"
              aria-label="Listas"
              aria-current={isListsActive ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                isListsActive ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <IconLists size={20} className="flex-shrink-0" />
            </Link>
          </Tooltip>

          {signedIn ? (
            <Tooltip content="Minhas curtidas" side="right" className="w-full">
              <button
                type="button"
                onClick={() => router.push('/favorites')}
                aria-label="Minhas curtidas"
                aria-current={path === '/favorites' ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                  path === '/favorites'
                    ? 'bg-bg-secondary text-ink-primary font-medium'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
                )}
              >
                <HeartAngle size={18} className="flex-shrink-0" />
              </button>
            </Tooltip>
          ) : null}

          <Tooltip content="Buscar" side="right" className="w-full">
            <button
              onClick={() => {
                if (signedIn) {
                  void import('@/components/SearchModal')
                  setShowSearch(true)
                } else openAuthPrompt('login')
              }}
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
          <CollapsedUserMenu isAdmin={isAdmin} onOpenSettings={() => {
            if (signedIn) {
              startNavigationFeedback()
              router.push('/settings')
            } else openAuthPrompt('login')
          }} />
        </div>
      </aside>

      {showSearch ? (
        <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} userTopics={userTopics} />
      ) : null}

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
