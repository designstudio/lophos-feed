'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'

const ADMIN_ID = 'user_3BBgSW8X0ymh0nSEW0aPy05pp4g'

interface Article { id: string; title: string; topic: string }
interface Suggestion { id: string; article_id: string; article_title: string; image_url: string; suggested_by: string; created_at: string }

function proxyImage(url: string) {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

export function CommunityWidget() {
  const { user } = useUser()
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)

  // Member state
  const [articles, setArticles] = useState<Article[]>([])
  const [selected, setSelected] = useState<Article | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Admin state
  const isAdmin = user?.id === ADMIN_ID
  const [pending, setPending] = useState<Suggestion[]>([])
  const [acting, setActing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Check membership
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
  }, [user, isAdmin])

  useEffect(() => { fetchData() }, [fetchData])

  const submit = async () => {
    if (!selected || !imageUrl.trim()) return
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/community/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selected.id, articleTitle: selected.title, imageUrl: imageUrl.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ text: 'Sugestão enviada!', ok: true })
        setSelected(null)
        setImageUrl('')
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

  if (loading || !isMember) return null

  return (
    <div className="rounded-2xl border border-border bg-bg-primary p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink-primary flex-shrink-0">
          <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.4"/>
          <circle cx="10.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 13c0-2.21 2.015-4 4.5-4s4.5 1.79 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M10.5 9c2.485 0 4.5 1.79 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <h3 className="text-[14px] font-semibold text-ink-primary">Comunidade</h3>
        {isAdmin && pending.length > 0 && (
          <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-accent)', color: '#fff' }}>
            {pending.length}
          </span>
        )}
      </div>

      {/* Admin: pending suggestions */}
      {isAdmin && pending.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary mb-2">Sugestões pendentes</p>
          <div className="space-y-3">
            {pending.map(s => (
              <div key={s.id} className="rounded-xl border border-border p-2.5 space-y-2">
                <p className="text-[12px] text-ink-primary font-medium leading-tight line-clamp-2">{s.article_title}</p>
                <img src={proxyImage(s.image_url)} alt="" className="w-full h-24 object-cover rounded-lg bg-bg-secondary"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                <div className="flex gap-2">
                  <button onClick={() => act(s.id, 'approve')} disabled={acting === s.id}
                    className="flex-1 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-accent)' }}>
                    {acting === s.id ? '…' : 'Aprovar'}
                  </button>
                  <button onClick={() => act(s.id, 'reject')} disabled={acting === s.id}
                    className="flex-1 py-1.5 rounded-lg text-[12px] font-medium text-ink-secondary transition-colors disabled:opacity-50 border border-border hover:border-border-strong">
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {articles.length > 0 && <div className="border-t border-border my-3" />}
        </div>
      )}

      {/* Member: suggest image for article */}
      {articles.length === 0 && !isAdmin && (
        <p className="text-[12px] text-ink-tertiary">Todos os artigos têm imagem. Volte mais tarde!</p>
      )}

      {articles.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary mb-2">
            Artigos sem imagem
          </p>
          <div className="space-y-1 mb-3">
            {articles.slice(0, 5).map(a => (
              <button key={a.id}
                onClick={() => { setSelected(s => s?.id === a.id ? null : a); setImageUrl(''); setMsg(null) }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-[12px] transition-colors"
                style={{
                  backgroundColor: selected?.id === a.id ? 'var(--color-bg-tertiary)' : 'transparent',
                  color: selected?.id === a.id ? 'var(--color-ink-primary)' : 'var(--color-ink-secondary)',
                }}
                onMouseEnter={e => { if (selected?.id !== a.id) (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)') }}
                onMouseLeave={e => { if (selected?.id !== a.id) (e.currentTarget.style.backgroundColor = 'transparent') }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-ink-tertiary)' }}>{a.topic}</span>
                <span className="line-clamp-2 leading-tight">{a.title}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-2">
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Cole a URL da imagem…"
                className="w-full text-[12px] px-3 py-2 rounded-lg border border-border outline-none bg-bg-primary text-ink-primary placeholder:text-ink-muted"
                style={{ borderColor: 'var(--color-border)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              />
              {imageUrl && (
                <img src={proxyImage(imageUrl)} alt="" className="w-full h-24 object-cover rounded-lg bg-bg-secondary"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
              )}
              <button onClick={submit} disabled={submitting || !imageUrl.trim()}
                className="w-full py-2 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-ui-strong)' }}>
                {submitting ? 'Enviando…' : 'Sugerir imagem'}
              </button>
              {msg && (
                <p className={`text-[11px] ${msg.ok ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
