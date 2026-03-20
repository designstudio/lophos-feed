'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'

const ADMIN_ID = 'user_3BBgSW8X0ymh0nSEW0aPy05pp4g'

interface Article { id: string; title: string; topic: string }
interface Suggestion { id: string; article_id: string; article_title: string; image_url: string; suggested_by: string; created_at: string }

function proxyImage(url: string) {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

export default function CommunityPage() {
  const { user, isLoaded } = useUser()
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const isAdmin = user?.id === ADMIN_ID

  // Member state
  const [articles, setArticles] = useState<Article[]>([])
  const [selected, setSelected] = useState<Article | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Admin state
  const [pending, setPending] = useState<Suggestion[]>([])
  const [acting, setActing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/community/suggestions?type=articles')
      if (r.status === 403) { setIsMember(false); setLoading(false); return }
      setIsMember(true)
      const data = await r.json()
      setArticles(data.articles || [])
      if (isAdmin) {
        const pr = await fetch('/api/community/suggestions?type=pending')
        const pd = await pr.json()
        setPending(pd.suggestions || [])
      }
    } catch {}
    setLoading(false)
  }, [isAdmin])

  useEffect(() => { if (isLoaded) fetchData() }, [fetchData, isLoaded])

  const submit = async () => {
    if (!selected || !imageUrl.trim()) return
    setSubmitting(true); setMsg(null)
    try {
      const res = await fetch('/api/community/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selected.id, articleTitle: selected.title, imageUrl: imageUrl.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ text: 'Sugestão enviada! Aguardando aprovação.', ok: true })
        setSelected(null); setImageUrl('')
        setArticles(prev => prev.filter(a => a.id !== selected.id))
      } else {
        setMsg({ text: data.error || 'Erro ao enviar.', ok: false })
      }
    } catch { setMsg({ text: 'Erro ao enviar.', ok: false }) }
    setSubmitting(false)
  }

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id)
    try {
      await fetch('/api/community/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      setPending(prev => prev.filter(s => s.id !== id))
    } catch {}
    setActing(null)
  }

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border px-8 header-blur">
        <div className="flex items-center h-14">
          <Link href="/feed"
            className="text-[15px] font-semibold text-ink-primary hover:text-ink-secondary transition-colors flex-shrink-0"
            style={{ width: '12rem' }}>
            Meu Feed
          </Link>
          <div className="flex-1 flex justify-center">
            <span className="text-[0.875rem] font-medium text-ink-primary">Comunidade</span>
          </div>
          <div style={{ width: '12rem' }} className="flex-shrink-0" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-8 py-8">
        {!isLoaded || loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : !isMember ? (
          <div className="text-center py-20">
            <p className="text-ink-tertiary text-sm">Você não tem acesso à área de comunidade.</p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* ── Admin: pending approvals ── */}
            {isAdmin && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-[15px] font-semibold text-ink-primary">Sugestões pendentes</h2>
                  {pending.length > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ background: 'var(--color-accent)' }}>
                      {pending.length}
                    </span>
                  )}
                </div>
                {pending.length === 0 ? (
                  <p className="text-sm text-ink-tertiary">Nenhuma sugestão pendente.</p>
                ) : (
                  <div className="space-y-4">
                    {pending.map(s => (
                      <div key={s.id} className="rounded-2xl border border-border p-4 space-y-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">Artigo</span>
                          <p className="text-[14px] font-medium text-ink-primary mt-0.5">{s.article_title}</p>
                        </div>
                        <img src={proxyImage(s.image_url)} alt=""
                          className="w-full h-48 object-cover rounded-xl bg-bg-secondary"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                        <p className="text-[11px] text-ink-muted break-all">{s.image_url}</p>
                        <div className="flex gap-3">
                          <button onClick={() => act(s.id, 'approve')} disabled={acting === s.id}
                            className="flex-1 py-2 rounded-xl text-[13px] font-medium text-white transition-colors disabled:opacity-50"
                            style={{ background: 'var(--color-accent)' }}>
                            {acting === s.id ? '…' : '✓ Aprovar'}
                          </button>
                          <button onClick={() => act(s.id, 'reject')} disabled={acting === s.id}
                            className="flex-1 py-2 rounded-xl text-[13px] font-medium text-ink-secondary border border-border hover:border-border-strong transition-colors disabled:opacity-50">
                            Rejeitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Member: suggest images ── */}
            <section>
              <h2 className="text-[15px] font-semibold text-ink-primary mb-1">Artigos sem imagem</h2>
              <p className="text-sm text-ink-tertiary mb-4">Selecione um artigo e cole a URL de uma imagem adequada.</p>

              {articles.length === 0 ? (
                <p className="text-sm text-ink-tertiary">Todos os artigos têm imagem. Volte mais tarde!</p>
              ) : (
                <div className="space-y-2">
                  {articles.map(a => (
                    <div key={a.id}>
                      <button
                        onClick={() => { setSelected(s => s?.id === a.id ? null : a); setImageUrl(''); setMsg(null) }}
                        className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                        style={{
                          borderColor: selected?.id === a.id ? 'var(--color-accent)' : 'var(--color-border)',
                          backgroundColor: selected?.id === a.id ? 'var(--color-bg-secondary)' : 'transparent',
                        }}>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary block mb-0.5">{a.topic}</span>
                        <span className="text-[14px] text-ink-primary leading-snug line-clamp-2">{a.title}</span>
                      </button>

                      {selected?.id === a.id && (
                        <div className="mt-2 space-y-3 px-1">
                          <input
                            value={imageUrl}
                            onChange={e => setImageUrl(e.target.value)}
                            placeholder="Cole a URL da imagem…"
                            className="w-full text-sm px-4 py-2.5 rounded-xl border border-border outline-none bg-bg-primary text-ink-primary placeholder:text-ink-muted transition-colors"
                            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                          />
                          {imageUrl.trim() && (
                            <img src={proxyImage(imageUrl)} alt=""
                              className="w-full h-40 object-cover rounded-xl bg-bg-secondary"
                              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                          )}
                          <button onClick={submit} disabled={submitting || !imageUrl.trim()}
                            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ background: 'var(--color-ui-strong)' }}>
                            {submitting ? 'Enviando…' : 'Sugerir imagem'}
                          </button>
                          {msg && (
                            <p className={`text-[12px] ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  )
}
