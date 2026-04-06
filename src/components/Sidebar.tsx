'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Feed,
  Refresh,
  AltArrowLeft,
  AltArrowRight,
  HeartAngle,
  Magnifer,
  Pen,
  TrashBinTrash,
  History,
  CloseCircle,
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
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [userTopics, setUserTopics] = useState<string[]>([])
  const [recentThreadsLoading, setRecentThreadsLoading] = useState(true)
  const [recentThreads, setRecentThreads] = useState<Array<{ id: string; title: string; article_id: string; updated_at: string }>>([])
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => setUserTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setRecentThreadsLoading(true)
    fetch('/api/chat/threads')
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((data) => setRecentThreads(data.threads || []))
      .catch(() => {})
      .finally(() => setRecentThreadsLoading(false))
  }, [path])

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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenThreadMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem('sidebar_collapsed', String(next))
      window.dispatchEvent(new CustomEvent('sidebar:toggle', { detail: { collapsed: next } }))
      return next
    })
  }

  const isCollapsed = collapsed ?? true
  const isReady = collapsed !== null
  const sidebarTransition = 'width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease'
  let resolvedWidth = 'var(--sidebar-width, 3.5rem)'
  if (collapsed !== null) {
    resolvedWidth = isCollapsed ? '3.5rem' : '16.1rem'
  }

  const handleRenameThread = async (threadId: string, currentTitle: string) => {
    const nextTitle = window.prompt('Renomear thread', currentTitle)?.trim()
    setOpenThreadMenuId(null)

    if (!nextTitle || nextTitle === currentTitle) return

    try {
      const response = await fetch('/api/chat/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          title: nextTitle,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao renomear thread')
      }

      setRecentThreads((prev) =>
        prev.map((thread) =>
          thread.id === threadId
            ? { ...thread, title: nextTitle }
            : thread
        )
      )
    } catch {
      window.alert('Não foi possível renomear a thread.')
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    const confirmed = window.confirm('Excluir esta thread?')
    setOpenThreadMenuId(null)

    if (!confirmed) return

    try {
      const response = await fetch('/api/chat/threads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir thread')
      }

      setRecentThreads((prev) => prev.filter((thread) => thread.id !== threadId))

      if (path === `/threads/${threadId}`) {
        router.push('/feed')
      }
    } catch {
      window.alert('Não foi possível excluir a thread.')
    }
  }

  const renderThreadList = (options?: { onNavigate?: () => void }) => (
    <div className="space-y-1">
      {recentThreads.map((thread) => {
        const isActive = path === `/threads/${thread.id}`

        return (
          <div
            key={thread.id}
            className={cn(
              'group relative rounded-xl transition-colors',
              isActive ? 'bg-bg-secondary text-ink-primary' : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary'
            )}
          >
            <div className="flex items-center gap-1">
              <Link
                href={`/threads/${thread.id}`}
                onClick={options?.onNavigate}
                className="min-w-0 flex-1 px-2.5 py-2"
              >
                <p className="truncate text-[0.875rem] font-medium leading-5">{thread.title}</p>
              </Link>

              <Tooltip content="Ações" side="right">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setOpenThreadMenuId((prev) => (prev === thread.id ? null : thread.id))
                  }}
                  className={cn(
                    'mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors',
                    openThreadMenuId === thread.id
                      ? 'bg-bg-secondary text-ink-primary'
                      : 'opacity-0 group-hover:opacity-100'
                  )}
                  aria-label="Ações"
                >
                  <span className="flex items-center gap-[3px]">
                    <span className="h-[3px] w-[3px] rounded-full bg-current" />
                    <span className="h-[3px] w-[3px] rounded-full bg-current" />
                    <span className="h-[3px] w-[3px] rounded-full bg-current" />
                  </span>
                </button>
              </Tooltip>
            </div>

            {openThreadMenuId === thread.id && (
              <div
                ref={menuRef}
                className="absolute right-1 top-10 z-20 min-w-[9rem] rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]"
              >
                <button
                  type="button"
                  onClick={() => void handleRenameThread(thread.id, thread.title)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                >
                  <Pen size={16} className="flex-shrink-0" />
                  <span>Renomear</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteThread(thread.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                >
                  <TrashBinTrash size={16} className="flex-shrink-0" />
                  <span>Excluir</span>
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const renderThreadSkeleton = () => (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl px-2.5 py-2">
          <div className="h-4 w-full rounded bg-bg-secondary animate-pulse" />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {!isReady && (
        <aside
          className="flex-shrink-0 flex flex-col h-full border-r border-border bg-bg-primary overflow-hidden"
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
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? 'auto' : 'none',
          transition: sidebarTransition,
        }}
      >
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
              maxWidth: collapsed ? 0 : '10rem',
              transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
              transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
              pointerEvents: 'none',
            }}
          >
            Lophos
          </span>

          <Tooltip content="Recolher menu" side="right" disabled={isCollapsed}>
            <button
              onClick={toggle}
              className="w-6 h-6 flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-bg-secondary transition-colors flex-shrink-0 ml-auto"
              style={{
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'translateX(8px) scale(0.92)' : 'translateX(0) scale(1)',
                transition: 'opacity 180ms ease, transform 220ms ease',
                pointerEvents: collapsed ? 'none' : 'auto',
              }}
            >
              <AltArrowLeft size={14} />
            </button>
          </Tooltip>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 min-h-0 px-2">
          <Tooltip content="Meu feed" side="right" disabled={!collapsed} className="w-full">
            <Link
              href="/feed"
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                path === '/feed' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <Feed size={18} className="flex-shrink-0" />
              <span
                className="whitespace-nowrap overflow-hidden"
                style={{
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : '10rem',
                  transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                  transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
                }}
              >
                Meu Feed
              </span>
            </Link>
          </Tooltip>

          <Tooltip content="Minhas curtidas" side="right" disabled={!collapsed} className="w-full">
            <Link
              href="/favorites"
              className={cn(
                'flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                path === '/favorites' ? 'bg-bg-secondary text-ink-primary font-medium' : 'text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary'
              )}
            >
              <HeartAngle size={18} className="flex-shrink-0" />
              <span
                className="whitespace-nowrap overflow-hidden"
                style={{
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : '10rem',
                  transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                  transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
                }}
              >
                Minhas curtidas
              </span>
            </Link>
          </Tooltip>

          <Tooltip content="Buscar" side="right" disabled={!collapsed} className="w-full">
            <button
              onClick={() => setShowSearch(true)}
              className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-secondary transition-colors hover:text-ink-primary hover:bg-bg-secondary"
            >
              <Magnifer size={18} className="flex-shrink-0" />
              <span
                className="whitespace-nowrap overflow-hidden"
                style={{
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : '10rem',
                  transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                  transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
                }}
              >
                Buscar
              </span>
            </button>
          </Tooltip>

          {collapsed && (
            <Tooltip content="Histórico" side="right" disabled={!collapsed} className="w-full">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                aria-label="Abrir histórico"
              >
                <History size={18} className="flex-shrink-0" />
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    opacity: 0,
                    maxWidth: 0,
                    transform: 'translateX(-6px)',
                    transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
                  }}
                >
                  Histórico
                </span>
              </button>
            </Tooltip>
          )}

          <div
            className="min-h-0 overflow-hidden"
            style={{
              opacity: collapsed ? 0 : 1,
              maxHeight: collapsed ? 0 : '22rem',
              transform: collapsed ? 'translateY(-4px)' : 'translateY(0)',
              transition: 'max-height 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease 90ms, transform 180ms ease 90ms',
              pointerEvents: collapsed ? 'none' : 'auto',
            }}
          >
            <div className="min-h-0 pt-3 pb-2">
              <div className="px-2.5 pb-2">
                <p className="text-[0.813rem] font-semibold text-ink-tertiary">
                  Histórico
                </p>
              </div>
              {recentThreadsLoading ? (
                <div className="pr-1">
                  {renderThreadSkeleton()}
                </div>
              ) : recentThreads.length > 0 ? (
                <div className="max-h-[18rem] overflow-y-auto pr-1">
                  {renderThreadList()}
                </div>
              ) : (
                <div className="px-2.5 py-2 text-[0.813rem] text-ink-tertiary">
                  Nenhuma conversa ainda
                </div>
              )}
            </div>
          </div>

          {onRefresh && (
            <Tooltip content={refreshTitle ?? refreshLabel ?? 'Atualizar feed'} side="right" disabled={!collapsed} className="w-full">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm text-ink-secondary transition-colors hover:text-ink-primary hover:bg-bg-secondary disabled:opacity-50"
              >
                <Refresh size={18} className={cn('flex-shrink-0', refreshing ? 'animate-spin' : '')} />
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    opacity: collapsed ? 0 : 1,
                    maxWidth: collapsed ? 0 : '10rem',
                    transform: collapsed ? 'translateX(-6px)' : 'translateX(0)',
                    transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
                  }}
                >
                  {refreshing ? 'Atualizando...' : refreshLabel ?? 'Atualizar feed'}
                </span>
              </button>
            </Tooltip>
          )}
        </nav>

        <div className="border-t border-border pt-3 px-2 pb-5 flex-shrink-0">
          {collapsed
            ? <CollapsedUserMenu onOpenSettings={() => setShowSettings(true)} />
            : <UserMenu onOpenSettings={() => setShowSettings(true)} />
          }
        </div>
      </aside>

      {showSettings && mounted && createPortal(
        <SettingsModal
          onClose={() => {
            setShowSettings(false)
            if (path === '/settings') router.push('/feed')
          }}
        />,
        document.body
      )}

      {showSearch && mounted && createPortal(
        <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} userTopics={userTopics} />,
        document.body
      )}

      {showHistoryModal && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-0"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={() => {
            setShowHistoryModal(false)
            setOpenThreadMenuId(null)
          }}
        >
          <div
            className="relative w-full max-w-xl max-h-[80vh] bg-white rounded-[1rem] shadow-2xl flex flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-sm font-semibold text-ink-primary">Histórico</h3>
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false)
                  setOpenThreadMenuId(null)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                aria-label="Fechar histórico"
              >
                <CloseCircle size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {recentThreadsLoading ? (
                renderThreadSkeleton()
              ) : recentThreads.length > 0 ? (
                renderThreadList({
                  onNavigate: () => {
                    setShowHistoryModal(false)
                    setOpenThreadMenuId(null)
                  },
                })
              ) : (
                <div className="py-10 text-center text-sm text-ink-tertiary">
                  Nenhuma conversa ainda
                </div>
              )}
            </div>
          </div>
        </div>,
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
