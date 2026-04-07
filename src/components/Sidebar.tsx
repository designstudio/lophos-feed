'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  RefreshCw05 as Refresh,
  ChevronLeft as AltArrowLeft,
  ChevronRight as AltArrowRight,
  Heart as HeartAngle,
  SearchMd as Magnifer,
  Edit02 as Pen,
  Trash03 as TrashBinTrash,
  ClockFastForward as History,
  X as CloseCircle,
  Check as CheckCircle,
  DotsVertical,
} from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { useFeedContext } from '@/components/FeedContext'
import { IconFeed } from '@/components/icons'
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

type ThreadItem = {
  id: string
  title: string
  article_id: string
  updated_at: string
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
  const [recentThreads, setRecentThreads] = useState<ThreadItem[]>([])
  const [navigatingThreadId, setNavigatingThreadId] = useState<string | null>(null)
  const [openThreadMenuId, setOpenThreadMenuId] = useState<string | null>(null)
  const [threadMenuPosition, setThreadMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingThreadTitle, setEditingThreadTitle] = useState('')
  const [renamingThread, setRenamingThread] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ThreadItem | null>(null)
  const [deletingThread, setDeletingThread] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const loadRecentThreads = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false

    if (showLoading) {
      setRecentThreadsLoading(true)
    }

    try {
      const response = await fetch('/api/chat/threads')
      const data = response.ok ? await response.json() : { threads: [] }
      setRecentThreads(data.threads || [])
    } catch {
      if (showLoading) {
        setRecentThreads([])
      }
    } finally {
      if (showLoading) {
        setRecentThreadsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetch('/api/topics')
      .then((r) => r.json())
      .then((data) => setUserTopics((data.topics || []).map((x: { topic: string }) => x.topic)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    void loadRecentThreads({ showLoading: true })
  }, [loadRecentThreads])

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
        setThreadMenuPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    const handleViewportChange = () => {
      setOpenThreadMenuId(null)
      setThreadMenuPosition(null)
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [])

  useEffect(() => {
    if (!path.startsWith('/threads/')) {
      setNavigatingThreadId(null)
    } else {
      setNavigatingThreadId(path.replace('/threads/', ''))
    }
  }, [path])

  useEffect(() => {
    const handleThreadsUpdated = () => {
      void loadRecentThreads()
    }

    window.addEventListener('threads:updated', handleThreadsUpdated)
    return () => {
      window.removeEventListener('threads:updated', handleThreadsUpdated)
    }
  }, [loadRecentThreads])

  useEffect(() => {
    if (editingThreadId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingThreadId])

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

  const resetThreadMenu = () => {
    setOpenThreadMenuId(null)
    setThreadMenuPosition(null)
  }

  const startInlineRename = (threadId: string, currentTitle: string) => {
    resetThreadMenu()
    setEditingThreadId(threadId)
    setEditingThreadTitle(currentTitle)
  }

  const cancelInlineRename = () => {
    setEditingThreadId(null)
    setEditingThreadTitle('')
    setRenamingThread(false)
  }

  const handleRenameThread = async (threadId: string, currentTitle: string) => {
    const nextTitle = editingThreadTitle.trim()

    if (!nextTitle || nextTitle === currentTitle) {
      cancelInlineRename()
      return
    }

    setRenamingThread(true)

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
      window.dispatchEvent(new Event('threads:updated'))
      cancelInlineRename()
    } catch {
      window.alert('Não foi possível renomear a thread.')
      setRenamingThread(false)
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    resetThreadMenu()
    setDeletingThread(true)

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
      window.dispatchEvent(new Event('threads:updated'))

      if (path === `/threads/${threadId}`) {
        router.push('/feed')
      }
      setDeleteTarget(null)
    } catch {
      window.alert('Não foi possível excluir a thread.')
    } finally {
      setDeletingThread(false)
    }
  }

  const renderThreadList = (options?: { onNavigate?: () => void }) => (
    <div className="space-y-1">
      {recentThreads.map((thread) => {
        const isActive = path === `/threads/${thread.id}`
        const isEditing = editingThreadId === thread.id
        const isNavigating = navigatingThreadId === thread.id && !isActive

        return (
          <div
            key={thread.id}
            className={cn(
              'group relative rounded-xl transition-colors',
              isActive
                ? 'bg-bg-secondary text-ink-primary'
                : isNavigating
                  ? 'bg-bg-secondary/70 text-ink-primary'
                  : 'text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary'
            )}
          >
            <div className="flex items-center gap-1">
              {isEditing ? (
                <div className="flex min-w-0 flex-1 items-center gap-1 px-2.5 py-2">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={editingThreadTitle}
                    onChange={(event) => setEditingThreadTitle(event.target.value)}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleRenameThread(thread.id, thread.title)
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelInlineRename()
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[0.875rem] font-medium leading-5 text-ink-primary outline-none"
                    disabled={renamingThread}
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      cancelInlineRename()
                    }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                    aria-label="Cancelar renomeação"
                  >
                    <CloseCircle size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void handleRenameThread(thread.id, thread.title)
                    }}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-bg-secondary hover:text-ink-primary disabled:opacity-50"
                    aria-label="Confirmar renomeação"
                    disabled={renamingThread || editingThreadTitle.trim().length === 0}
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
              ) : (
                <Link
                  href={`/threads/${thread.id}`}
                  onClick={() => {
                    setNavigatingThreadId(thread.id)
                    options?.onNavigate?.()
                  }}
                  className="min-w-0 flex-1 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] font-medium leading-5">{thread.title}</p>
                  </div>
                </Link>
              )}

              {!isEditing && (
                <Tooltip content="Ações" side="right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      const menuWidth = 144
                      const nextLeft = Math.min(
                        rect.right - menuWidth,
                        window.innerWidth - menuWidth - 12
                      )
                      const nextTop = rect.bottom + 6

                      setOpenThreadMenuId((prev) => {
                        const nextId = prev === thread.id ? null : thread.id
                        setThreadMenuPosition(nextId ? { top: nextTop, left: Math.max(12, nextLeft) } : null)
                        return nextId
                      })
                    }}
                    className={cn(
                      'mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-tertiary transition-colors',
                      openThreadMenuId === thread.id
                        ? 'bg-bg-secondary text-ink-primary'
                        : 'opacity-0 group-hover:opacity-100'
                    )}
                    aria-label="Ações"
                  >
                    <DotsVertical size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
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
          className="my-4 ml-4 mr-4 flex flex-shrink-0 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-bg-primary shadow-[0_12px_40px_rgba(17,17,17,0.05)]"
          style={{
            width: resolvedWidth,
            height: 'calc(100dvh - 2rem)',
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
        className="my-4 ml-4 mr-4 flex flex-shrink-0 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-bg-primary shadow-[0_12px_40px_rgba(17,17,17,0.05)]"
        style={{
          width: resolvedWidth,
          height: 'calc(100dvh - 2rem)',
          opacity: isReady ? 1 : 0,
          pointerEvents: isReady ? 'auto' : 'none',
          transition: sidebarTransition,
        }}
      >
        <div className="flex items-center px-3 mb-6 flex-shrink-0" style={{ minHeight: '2.5rem', paddingTop: '0.75rem' }}>
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
            className="font-display text-ink-primary flex-1 whitespace-nowrap overflow-hidden"
            style={{
              marginLeft: '0.25rem',
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              opacity: collapsed ? 0 : 1,
              maxWidth: collapsed ? 0 : '10rem',
              transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
              transition: 'max-width 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms ease',
              pointerEvents: 'none',
            }}
          >
            lophos
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
              <IconFeed size={18} className="flex-shrink-0" />
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

          {!collapsed && (
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
          )}

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
            resetThreadMenu()
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
                  resetThreadMenu()
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
                    resetThreadMenu()
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

      {openThreadMenuId && threadMenuPosition && mounted && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[10000] min-w-[9rem] rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]"
          style={{
            top: threadMenuPosition.top,
            left: threadMenuPosition.left,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const thread = recentThreads.find((item) => item.id === openThreadMenuId)
              if (thread) startInlineRename(thread.id, thread.title)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
          >
            <Pen size={16} className="flex-shrink-0" />
            <span>Renomear</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const thread = recentThreads.find((item) => item.id === openThreadMenuId)
              if (thread) {
                resetThreadMenu()
                setDeleteTarget(thread)
              }
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
          >
            <TrashBinTrash size={16} className="flex-shrink-0" />
            <span>Excluir</span>
          </button>
        </div>,
        document.body
      )}

      {deleteTarget && mounted && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={() => {
            if (deletingThread) return
            setDeleteTarget(null)
          }}
        >
          <div
            className="relative w-full max-w-md rounded-[1rem] border border-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[1.05rem] font-semibold text-ink-primary">
                Excluir thread?
              </h3>
            </div>

            <div className="px-4 pb-5">
              <p className="text-sm leading-6 text-ink-secondary">
                Isso excluirá <span className="font-semibold text-ink-primary">{deleteTarget.title}</span>.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-tertiary">
                Essa ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingThread}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteThread(deleteTarget.id)}
                disabled={deletingThread}
                className="rounded-full bg-[#E5484D] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletingThread ? 'Excluindo...' : 'Excluir'}
              </button>
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
