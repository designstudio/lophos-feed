'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowNarrowLeft as ArrowLeft,
  DotsHorizontal,
  Edit02 as Pen,
  Trash03 as TrashBinTrash,
  X as CloseCircle,
  Check as CheckCircle,
} from '@untitledui/icons'
import { ChatThread } from '@/components/ChatThread'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUpSuggestions?: string[]
  createdAt: string
}

interface ThreadPageClientProps {
  threadId: string
  thread: {
    id: string
    title: string
    article_id: string
  }
  article: {
    id: string
    title: string
    image_url: string
    topic: string
    published_at: string
  }
  initialMessages: ChatMessage[]
}

export function ThreadPageClient({
  threadId,
  thread,
  article,
  initialMessages,
}: ThreadPageClientProps) {
  const router = useRouter()
  const [showTitle, setShowTitle] = useState(false)
  const [currentTitle, setCurrentTitle] = useState(thread.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(thread.title)
  const [renamingThread, setRenamingThread] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingThread, setDeletingThread] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowTitle(!entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (titleRef.current) {
      observer.observe(titleRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (editingTitle && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingTitle])

  const cancelRename = () => {
    setEditingTitle(false)
    setDraftTitle(currentTitle)
    setRenamingThread(false)
  }

  const handleRenameThread = async () => {
    const nextTitle = draftTitle.trim()

    if (!nextTitle || nextTitle === currentTitle) {
      cancelRename()
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

      setCurrentTitle(nextTitle)
      setDraftTitle(nextTitle)
      setEditingTitle(false)
      window.dispatchEvent(new Event('threads:updated'))
    } catch {
      window.alert('Não foi possível renomear a thread.')
    } finally {
      setRenamingThread(false)
    }
  }

  const handleDeleteThread = async () => {
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

      window.dispatchEvent(new Event('threads:updated'))
      router.push('/feed')
    } catch {
      window.alert('Não foi possível excluir a thread.')
      setDeletingThread(false)
    }
  }

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-w-0 transition-all duration-300">
        <div className="app-header-shell">
          <div className="app-header-inner">
            <div className="app-header-pill header-blur flex items-center gap-3 px-4 md:px-5">
            <Link
              href={`/article/${article.id}`}
              className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-[1rem] border border-border hover:bg-bg-secondary text-[13px] font-medium text-ink-secondary hover:text-ink-primary transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} className="flex-shrink-0" />
              <span className="hidden sm:inline">Voltar para artigo</span>
            </Link>

            <div className="flex-1 flex justify-center overflow-hidden px-2">
              <span
                className="text-[0.875rem] font-medium text-ink-primary truncate max-w-lg transition-all duration-200"
                style={{ opacity: showTitle ? 1 : 0, transform: showTitle ? 'translateY(0)' : 'translateY(4px)' }}
              >
                {currentTitle}
              </span>
            </div>

            <div ref={menuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-[0.9rem] text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                aria-label="Ações da thread"
              >
                <DotsHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-30 min-w-[9rem] rounded-xl border border-border bg-white p-1 shadow-[0_18px_40px_rgba(20,20,20,0.12)]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setEditingTitle(true)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                  >
                    <Pen size={16} className="flex-shrink-0" />
                    <span>Renomear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setDeleteConfirmOpen(true)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                  >
                    <TrashBinTrash size={16} className="flex-shrink-0" />
                    <span>Excluir</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        <div ref={titleRef} className="px-4 md:px-8 pt-10 pb-6">
          <Link
            href={`/article/${article.id}`}
            className="mx-auto flex max-w-[45rem] gap-3 rounded-[1rem] border border-border p-5 transition-all group cursor-pointer hover:border-border-strong hover:bg-bg-secondary"
          >
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider group-hover:text-ink-secondary transition-colors">
                  {article.topic}
                </span>
              </div>
              <h2 className="font-bold text-sm leading-tight text-ink-primary line-clamp-2 group-hover:text-accent transition-colors">
                {article.title}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {new Date(article.published_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </Link>
        </div>

        <main className="page-scroll">
          <div className="article-layout mx-auto px-0 py-6 pb-10">
            <ChatThread
              threadId={threadId}
              articleId={article.id}
              initialMessages={initialMessages}
              isEmbedded={false}
              autoRespond={true}
            />
          </div>
        </main>
      </div>

      {editingTitle && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={cancelRename}
        >
          <div
            className="relative w-full max-w-md rounded-[1rem] border border-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[1.05rem] font-semibold text-ink-primary">
                Renomear thread
              </h3>
            </div>

            <div className="px-4 pb-5">
              <input
                ref={renameInputRef}
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleRenameThread()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelRename()
                  }
                }}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink-primary outline-none transition-colors focus:border-accent"
                disabled={renamingThread}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={cancelRename}
                disabled={renamingThread}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRenameThread()}
                disabled={renamingThread || draftTitle.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ui-strong)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle size={16} />
                <span>{renamingThread ? 'Salvando...' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmOpen && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={() => {
            if (deletingThread) return
            setDeleteConfirmOpen(false)
          }}
        >
          <div
            className="relative w-full max-w-md rounded-[1rem] border border-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[1.05rem] font-semibold text-ink-primary">
                  Excluir thread?
                </h3>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary transition-colors hover:bg-bg-secondary hover:text-ink-primary"
                  aria-label="Fechar"
                >
                  <CloseCircle size={18} />
                </button>
              </div>
            </div>

            <div className="px-4 pb-5">
              <p className="text-sm leading-6 text-ink-secondary">
                Isso excluirá <span className="font-semibold text-ink-primary">{currentTitle}</span>.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-tertiary">
                Essa ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deletingThread}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-bg-secondary hover:text-ink-primary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteThread()}
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
