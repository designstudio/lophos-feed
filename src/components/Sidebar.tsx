'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Feed, Refresh, AltArrowLeft, AltArrowRight,
  HeartAngle, Magnifer
} from '@solar-icons/react-perf/Linear'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { LophosLogo } from '@/components/LophosLogo'
import { SearchModal } from '@/components/SearchModal'
import { Tooltip } from '@/components/Tooltip'
import { SettingsModal } from './sidebar/SettingsModal'
import { UserMenu } from './sidebar/UserMenu'
import { CollapsedUserMenu } from './sidebar/CollapsedUserMenu'

interface Props {
  onRefresh?: () => void
  refreshing?: boolean
  refreshLabel?: string
  refreshTitle?: string
}

export function Sidebar({ onRefresh, refreshing, refreshLabel, refreshTitle }: Props) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [userTopics, setUserTopics] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => setUserTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed') === 'true'
      setCollapsed(saved)
    } catch {
      setCollapsed(false)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (path === '/settings') {
      setShowSettings(true)
    }
  }, [path])

  const toggle = () => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const isCollapsed = collapsed ?? true
  const isReady = collapsed !== null
  let resolvedWidth = 'var(--sidebar-width, 3.5rem)'
  if (collapsed !== null) {
    resolvedWidth = isCollapsed ? '3.5rem' : '16.1rem'
  }

  return (
    <div>
      {!isReady && (
        <aside
          className="flex-shrink-0 flex flex-col h-full border-r border-border bg-bg-primary"
          style={{
            width: resolvedWidth,
            transition: 'none',
          }}
        >
          <div className="h-14 flex items-center justify-center border-b border-border">
            <div className="w-6 h-6 rounded-md bg-bg-secondary" />
          </div>
          <div className="flex-1 px-2 py-3 flex flex-col gap-2">
            <div className="h-9 rounded-lg bg-bg-secondary" />
            <div className="h-9 rounded-lg bg-bg-secondary" />
            <div className="h-9 rounded-lg bg-bg-secondary" />
          </div>
          <div className="border-t border-border px-2 py-4">
            <div className="h-10 rounded-lg bg-bg-secondary" />
          </div>
        </aside>
      )}
      <aside
        className="flex-shrink-0 flex flex-col h-full border-r border-border bg-bg-primary"
        style={{
          width: resolvedWidth,
          transition: mounted ? 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? 'auto' : 'none',
          willChange: 'width',
        }}
      >
        {/* Header */}
        <div className="flex items-center px-3 pt-5 mb-6 flex-shrink-0" style={{ minHeight: '2.5rem' }}>
          <Tooltip content="Expandir menu" side="right" disabled={!collapsed}>
            <div
              className={cn('flex-shrink-0 relative', collapsed ? 'group cursor-pointer' : '')}
              onClick={collapsed ? toggle : undefined}
            >
              <div className={collapsed ? 'group-hover:opacity-0 transition-opacity' : ''}>
                <LophosLogo size={34} />
              </div>
              {collapsed && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <AltArrowRight size={16} className="text-ink-secondary" />
                </div>
              )}
            </div>
          </Tooltip>

          <span
            className="font-display text-lg text-ink-primary flex-1 whitespace-nowrap overflow-hidden ml-2.5"
            style={{
              opacity: collapsed ? 0 : 1,
              width: collapsed ? 0 : 'auto',
              transition: 'opacity 0.15s ease',
              pointerEvents: 'none',
            }}
          >
            Lophos
          </span>

          {!collapsed && (
            <Tooltip content="Recolher menu" side="top">
              <button
                onClick={toggle}
                className="w-6 h-6 flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-bg-secondary transition-colors flex-shrink-0 ml-auto"
              >
                <AltArrowLeft size={14} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1 px-2">
          <Tooltip content="Início" side="right" disabled={!collapsed} className="w-full">
            <Link href="/feed"
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                collapsed ? 'justify-center' : '',
                path === '/feed' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}>
              <Feed size={18} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">Meu Feed</span>}
            </Link>
          </Tooltip>

          <Tooltip content="Minhas curtidas" side="right" disabled={!collapsed} className="w-full">
            <Link href="/favorites"
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                collapsed ? 'justify-center' : '',
                path === '/favorites' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}>
              <HeartAngle size={18} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">Minhas curtidas</span>}
            </Link>
          </Tooltip>

          <Tooltip content="Buscar" side="right" disabled={!collapsed} className="w-full">
            <button
              onClick={() => setShowSearch(true)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                collapsed ? 'justify-center' : '',
                'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}>
              <Magnifer size={18} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap overflow-hidden">Buscar</span>}
            </button>
          </Tooltip>

          {onRefresh && (
            <Tooltip content={refreshTitle ?? refreshLabel ?? 'Atualizar feed'} side="right" disabled={!collapsed} className="w-full">
              <button onClick={onRefresh} disabled={refreshing}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 text-left',
                  collapsed ? 'justify-center' : ''
                )}>
                <Refresh size={18} className={cn('flex-shrink-0', refreshing ? 'animate-spin' : '')} />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">
                    {refreshing ? 'Atualizando...' : (refreshLabel ?? 'Atualizar feed')}
                  </span>
                )}
              </button>
            </Tooltip>
          )}
        </nav>

        {/* Bottom user */}
        <div className="border-t border-border pt-3 px-2 pb-5 flex-shrink-0">
          {collapsed
            ? <CollapsedUserMenu onOpenSettings={() => setShowSettings(true)} />
            : <UserMenu onOpenSettings={() => setShowSettings(true)} />
          }
        </div>
      </aside>

      {showSettings && mounted && createPortal(
        <SettingsModal onClose={() => {
          setShowSettings(false)
          if (path === '/settings') router.push('/feed')
        }} />,
        document.body
      )}

      {showSearch && mounted && createPortal(
        <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} userTopics={userTopics} />,
        document.body
      )}
    </div>
  )
}

// Context-aware wrapper for use in shared layout
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
