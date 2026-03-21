'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { NewsItem, NewsSource } from '@/lib/types'
import { SquareTopDown, ClockCircle, CloseCircle } from '@solar-icons/react-perf/Linear'
import { ArticleEditor } from '@/components/ArticleEditor'
import { useUser } from '@clerk/nextjs'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function SourceCard({ src }: { src: NewsSource }) {
  return (
    <a href={src.url} target="_blank" rel="noopener noreferrer"
      className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all group"
    >
      <div className="flex items-center justify-between">
        {src.favicon ? (
          <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />
        )}
        <SquareTopDown size={12} className="text-ink-muted" />
      </div>
      <p className="text-[12px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate leading-tight">
        {src.name}
      </p>
    </a>
  )
}



export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllSources, setShowAllSources] = useState(false)

  useEffect(() => {
    fetch(`/api/article?id=${id}`)
      .then((r) => r.json())
      .then((data) => { setItem(data.item || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const shownSources = item?.sources?.slice(0, 3) || []
  const extraCount = (item?.sources?.length || 0) - 3
  const scrollRef      = useRef<HTMLDivElement>(null)
  const titleRef       = useRef<HTMLHeadingElement>(null)
  const menuRef        = useRef<HTMLDivElement>(null)
  const [showTitle, setShowTitle]     = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [editMode, setEditMode]         = useState(false)
  const [isMember, setIsMember]         = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorMsg, setEditorMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const editorSaveRef = useRef<(() => void) | null>(null)
  const { isLoaded } = useUser()


  // Close ... menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  // Check community membership
  useEffect(() => {
    if (!isLoaded) return
    fetch('/api/community/suggestions')
      .then(r => { if (r.ok) setIsMember(true) })
      .catch(() => {})
  }, [isLoaded])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (!titleRef.current) return
      const titleBottom = titleRef.current.getBoundingClientRect().bottom
      setShowTitle(titleBottom < 56) // 56 = header height
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-w-0 transition-all duration-300">
        {/* ── Sticky header — matches feed header style ── */}
        <div className="sticky top-0 z-20 border-b border-border px-8 header-blur">
          <div className="flex items-center h-14">
            <Link href="/feed"
              className="text-[15px] font-semibold text-ink-primary hover:text-ink-secondary transition-colors flex-shrink-0"
              style={{ width: '12rem' }}>
              Descobrir
            </Link>
            {/* Article title — appears when user scrolls past the h1 */}
            <div className="flex-1 flex justify-center overflow-hidden px-4">
              <span
                className="text-[0.875rem] font-medium text-ink-primary truncate max-w-lg transition-all duration-200"
                style={{ opacity: showTitle ? 1 : 0, transform: showTitle ? 'translateY(0)' : 'translateY(4px)' }}
              >
                {item?.title}
              </span>
            </div>
            {/* Right side */}
            <div style={{ width: '12rem' }} className="flex-shrink-0 flex items-center justify-end gap-2 relative">
              {editMode ? (
                <>
                  {editorMsg && (
                    <span className={`text-[11px] whitespace-nowrap ${editorMsg.ok ? 'text-green-500' : 'text-red-400'}`}>
                      {editorMsg.text}
                    </span>
                  )}
                  <button onClick={() => setEditMode(false)}
                    className="text-[13px] text-ink-muted hover:text-ink-secondary transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={() => editorSaveRef.current?.()}
                    disabled={editorSaving}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-ui-strong)' }}>
                    {editorSaving ? 'Enviando…' : 'Enviar revisão'}
                  </button>
                </>
              ) : (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-bg-secondary transition-colors text-ink-muted hover:text-ink-secondary"
                  title="Mais opções"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="2.5" cy="7" r="1.25" />
                    <circle cx="7"   cy="7" r="1.25" />
                    <circle cx="11.5" cy="7" r="1.25" />
                  </svg>
                </button>
                {menuOpen && isMember && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl border shadow-xl z-50 py-1"
                    style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', animation: 'slideUp 0.12s ease' }}
                  >
                    <button
                      onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
                      onClick={() => { setMenuOpen(false); setEditMode(true) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors text-left"
                      style={{ color: 'var(--color-ink-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 9.5L9 2l2 2-7.5 7.5H1.5v-2z"/>
                      </svg>
                      Editar artigo
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>

      <main className="page-scroll">
        {editMode && item ? (
          <ArticleEditor
            item={item}
            onClose={() => setEditMode(false)}
            onSaved={() => setEditMode(false)}
            onSavingChange={setEditorSaving}
            onMsgChange={setEditorMsg}
            saveRef={editorSaveRef}
          />
        ) : null}
        <div className="article-layout mx-auto py-6" style={{ display: editMode ? 'none' : undefined }}>

          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-3 bg-bg-secondary rounded w-20" />
              <div className="h-9 bg-bg-secondary rounded w-4/5" />
              <div className="h-9 bg-bg-secondary rounded w-3/5" />
              <div className="h-3 bg-bg-secondary rounded w-32" />
              <div className="h-56 bg-bg-secondary rounded-xl" />
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-4 bg-bg-secondary rounded" style={{ width: `${100 - i*5}%` }} />)}
              </div>
            </div>
          )}

          {!loading && !item && (
            <div className="text-center py-20 text-ink-tertiary">Artigo não encontrado.</div>
          )}

          {!loading && item && (
            <article className="animate-fade-in">
              {/* Topic + title */}
              <span className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{item.topic}</span>
              <h1 ref={titleRef} className="text-ink-primary leading-tight mt-2 mb-3" style={{ fontSize: '2.3rem', lineHeight: '1.25' }}>{item.title}</h1>

              {/* Recency line */}
              <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
                <ClockCircle size={16} />
                <span>Publicado {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ptBR })}</span>
              </div>

              {/* Hero image with source attribution overlay */}
              {item.imageUrl && (
                <div className="rounded-xl overflow-hidden mb-6 bg-bg-secondary relative">
                  <img src={item.imageUrl} alt={item.title} className="article-image"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                  {item.sources?.[0] && (
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-1.5"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}>
                      {item.sources[0].favicon && (
                        <img src={item.sources[0].favicon} alt="" width={12} height={12} className="rounded-sm opacity-90"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                      <span className="text-[11px] text-white/80 font-medium">{item.sources[0].name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Intro paragraph */}
              <p className="text-body text-ink-secondary leading-relaxed mb-8">{item.summary}</p>

              {/* Thematic sections */}
              {item.sections && item.sections.length > 0 && (
                <div className="space-y-6 mb-8">
                  {item.sections.map((section, i) => (
                    <div key={i}>
                      <h2 className="text-[15px] font-semibold text-ink-primary mb-2">{section.heading}</h2>
                      <p className="text-body text-ink-secondary leading-relaxed">{section.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Conclusion / O que esperar */}
              {item.conclusion && (
                <div className="rounded-xl border border-border bg-bg-secondary p-4 mb-8">
                  <h2 className="text-[13px] font-semibold text-ink-primary mb-1.5">O que esperar</h2>
                  <p className="text-[14px] text-ink-secondary leading-relaxed">{item.conclusion}</p>
                </div>
              )}

              {/* Sources */}
              {item.sources && item.sources.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wider mb-3">
                    {item.sources.length} fonte{item.sources.length !== 1 ? 's' : ''}
                  </h2>
                  <div className="flex gap-2 items-stretch">
                    {shownSources.map((src, i) => (
                      <div key={i} className="flex-1 min-w-0"><SourceCard src={src} /></div>
                    ))}
                    {extraCount > 0 && (
                      <button onClick={() => setShowAllSources(true)}
                        className="flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-white hover:border-border-strong hover:bg-bg-secondary transition-all min-w-[80px]"
                      >
                        <div className="flex items-center">
                          {item.sources.slice(3, 6).map((src, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border-2 border-white overflow-hidden bg-bg-secondary"
                              style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: 3 - i }}>
                              {src.favicon && <img src={src.favicon} alt="" width={16} height={16} className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] font-medium text-ink-secondary whitespace-nowrap">+{extraCount} fontes</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          )}
        </div>
      </main>
      </div>

      {/* ── Sources panel — pushes content, slides in from right ── */}
      <div
        className="flex-shrink-0 border-l border-border overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: showAllSources ? '20rem' : '0', opacity: showAllSources ? 1 : 0 }}
      >
        <div className="w-80 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0" style={{ height: '57px' }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {(item?.sources || []).slice(0, 3).map((src, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border-2 border-bg-primary overflow-hidden bg-bg-secondary flex-shrink-0"
                    style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: 3 - i }}>
                    {src.favicon
                      ? <img src={src.favicon} alt="" width={20} height={20} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <span className="w-full h-full block bg-bg-tertiary" />}
                  </div>
                ))}
              </div>
              <h2 className="text-[15px] font-semibold text-ink-primary">Fontes</h2>
            </div>
            <button onClick={() => setShowAllSources(false)} className="text-ink-tertiary hover:text-ink-primary transition-colors">
              <CloseCircle size={20} />
            </button>
          </div>
          {/* List */}
          <div className="overflow-y-auto flex-1 px-4 py-3">
            {(item?.sources || []).map((src, i) => (
              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:opacity-70 transition-opacity group"
              >
                {src.favicon
                  ? <img src={src.favicon} alt="" width={20} height={20} className="rounded-md flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <span className="w-5 h-5 rounded-md bg-bg-tertiary flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink-primary group-hover:text-accent transition-colors truncate">{src.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">{src.url}</p>
                </div>
                <SquareTopDown size={12} className="text-ink-muted flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
