'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

const ADMIN_ID = 'user_3BBgSW8X0ymh0nSEW0aPy05pp4g'

interface Edit {
  id: string
  article_id: string
  edited_by: string
  original: { title: string; summary: string; sections: { heading: string; body: string }[] }
  changes: { title?: string; summary?: string; sections?: { heading: string; body: string }[] }
  created_at: string
}

function DiffField({ label, before, after }: { label: string; before: string; after: string }) {
  if (before === after) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3 text-[13px] text-ink-secondary leading-relaxed line-clamp-4"
          style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          {before}
        </div>
        <div className="rounded-lg p-3 text-[13px] text-ink-primary leading-relaxed line-clamp-4"
          style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          {after}
        </div>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const { user, isLoaded } = useUser()
  const [status, setStatus] = useState<'loading' | 'member' | 'denied'>('loading')
  const isAdmin = user?.id === ADMIN_ID
  const [tab, setTab] = useState<'welcome' | 'edits'>('welcome')
  const [edits, setEdits] = useState<Edit[]>([])
  const [loadingEdits, setLoadingEdits] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    fetch('/api/community/suggestions')
      .then(r => setStatus(r.ok ? 'member' : 'denied'))
      .catch(() => setStatus('denied'))
  }, [isLoaded])

  const fetchEdits = useCallback(async () => {
    setLoadingEdits(true)
    try {
      const r = await fetch('/api/community/edits')
      const d = await r.json()
      setEdits(d.edits || [])
    } catch {}
    setLoadingEdits(false)
  }, [])

  useEffect(() => {
    if (tab === 'edits' && isAdmin) fetchEdits()
  }, [tab, isAdmin, fetchEdits])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id)
    try {
      await fetch('/api/community/edits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      setEdits(prev => prev.filter(e => e.id !== id))
    } catch {}
    setActing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      <div className="sticky top-0 z-20 border-b border-border px-8 header-blur">
        <div className="flex items-center h-14">
          <Link href="/feed"
            className="text-[15px] font-semibold text-ink-primary hover:text-ink-secondary transition-colors flex-shrink-0"
            style={{ width: '12rem' }}>
            Meu Feed
          </Link>
          <div className="flex flex-1 justify-center gap-1">
            {(['welcome', 'edits'] as const).filter(t => t === 'welcome' || isAdmin).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 h-14 text-[0.875rem] border-b-2 transition-all font-medium"
                style={{
                  borderColor: tab === t ? 'var(--color-ink-primary)' : 'transparent',
                  color: tab === t ? 'var(--color-ink-primary)' : 'var(--color-ink-tertiary)',
                }}>
                {t === 'welcome' ? 'Comunidade' : `Revisões${edits.length > 0 ? ` (${edits.length})` : ''}`}
              </button>
            ))}
          </div>
          <div style={{ width: '12rem' }} className="flex-shrink-0" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-8 py-10">
        {status === 'loading' && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-xl" style={{ width: `${70 - i * 10}%` }} />)}
          </div>
        )}

        {status === 'denied' && (
          <div className="text-center py-20">
            <p className="text-ink-tertiary text-sm">Você não tem acesso à área de comunidade.</p>
          </div>
        )}

        {status === 'member' && tab === 'welcome' && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'var(--color-bg-secondary)' }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-ink-primary">
                <circle cx="11" cy="10" r="4" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="21" cy="10" r="4" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M3 26c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M21 18c4.418 0 8 3.582 8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[22px] font-semibold text-ink-primary">Bem-vindo à Comunidade</h1>
            <p className="text-sm text-ink-tertiary max-w-sm mx-auto leading-relaxed">
              Como membro, você pode sugerir edições nos artigos do feed. Abra qualquer artigo e clique em <strong className="text-ink-secondary">···</strong> para editar.
            </p>
          </div>
        )}

        {status === 'member' && tab === 'edits' && isAdmin && (
          <div className="space-y-6">
            <h2 className="text-[15px] font-semibold text-ink-primary">Edições pendentes</h2>
            {loadingEdits && (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
              </div>
            )}
            {!loadingEdits && edits.length === 0 && (
              <p className="text-sm text-ink-tertiary">Nenhuma edição pendente.</p>
            )}
            {!loadingEdits && edits.map(e => (
              <div key={e.id} className="rounded-2xl border border-border p-5 space-y-4">
                {/* Diff */}
                <DiffField label="Título" before={e.original.title} after={e.changes.title ?? e.original.title} />
                <DiffField label="Sumário" before={e.original.summary} after={e.changes.summary ?? e.original.summary} />
                {e.changes.sections && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary mb-2">Seções</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {e.original.sections.map((s, i) => (
                          <div key={i}>
                            <p className="text-[12px] font-semibold text-ink-secondary">{s.heading}</p>
                            <p className="text-[11px] text-ink-muted line-clamp-2">{s.body}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        {e.changes.sections.map((s, i) => (
                          <div key={i}>
                            <p className="text-[12px] font-semibold text-ink-primary">{s.heading}</p>
                            <p className="text-[11px] text-ink-secondary line-clamp-2">{s.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => act(e.id, 'approve')} disabled={acting === e.id}
                    className="flex-1 py-2 rounded-xl text-[13px] font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-accent)' }}>
                    {acting === e.id ? '…' : '✓ Aprovar'}
                  </button>
                  <button onClick={() => act(e.id, 'reject')} disabled={acting === e.id}
                    className="flex-1 py-2 rounded-xl text-[13px] font-medium text-ink-secondary border border-border hover:border-border-strong transition-colors disabled:opacity-50">
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
