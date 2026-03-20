'use client'
import { useState, useRef, useEffect } from 'react'
import { NewsItem, ArticleSection } from '@/lib/types'

interface Props {
  item: NewsItem
  onClose: () => void
  onSaved: () => void
}

export function ArticleEditor({ item, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(item.title)
  const [summary, setSummary] = useState(item.summary)
  const [sections, setSections] = useState<ArticleSection[]>(item.sections || [])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)
  const dragIdx = useRef<number | null>(null)

  // Auto-resize summary textarea
  useEffect(() => {
    const el = summaryRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [summary])

  const updateSection = (i: number, field: 'heading' | 'body', value: string) => {
    setSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const addSection = () => {
    setSections(prev => [...prev, { heading: '', body: '' }])
  }

  const removeSection = (i: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== i))
  }

  const moveSection = (from: number, to: number) => {
    setSections(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  const hasChanges = () => {
    if (title !== item.title) return true
    if (summary !== item.summary) return true
    if (JSON.stringify(sections) !== JSON.stringify(item.sections || [])) return true
    return false
  }

  const save = async () => {
    if (!hasChanges()) { setMsg({ text: 'Nenhuma alteração feita.', ok: false }); return }
    setSaving(true); setMsg(null)

    const changes: any = {}
    if (title !== item.title) changes.title = title
    if (summary !== item.summary) changes.summary = summary
    if (JSON.stringify(sections) !== JSON.stringify(item.sections || [])) changes.sections = sections

    try {
      const res = await fetch('/api/community/edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: item.id,
          original: { title: item.title, summary: item.summary, sections: item.sections || [] },
          changes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ text: 'Edição enviada para aprovação!', ok: true })
        setTimeout(() => { onSaved() }, 1500)
      } else {
        setMsg({ text: data.error || 'Erro ao enviar.', ok: false })
      }
    } catch { setMsg({ text: 'Erro ao enviar.', ok: false }) }
    setSaving(false)
  }

  return (
    <div className="border-b border-border bg-bg-secondary">
      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">

        {/* Editor header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-tertiary">Modo edição</span>
          </div>
          <button onClick={onClose} className="text-[12px] text-ink-muted hover:text-ink-secondary transition-colors">
            Cancelar
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary block mb-1.5">Título</label>
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={e => setTitle((e.target as HTMLDivElement).innerText)}
            className="w-full text-[1.4rem] font-semibold text-ink-primary leading-tight outline-none border-b border-transparent focus:border-border pb-1 transition-colors"
            style={{ minHeight: '2rem' }}
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </div>

        {/* Summary */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary block mb-1.5">Sumário</label>
          <textarea
            ref={summaryRef}
            value={summary}
            onChange={e => setSummary(e.target.value)}
            className="w-full text-sm text-ink-secondary leading-relaxed outline-none resize-none bg-transparent border-b border-transparent focus:border-border pb-1 transition-colors"
            style={{ minHeight: '4rem' }}
          />
        </div>

        {/* Sections */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary block mb-3">Seções</label>
          <div className="space-y-4">
            {sections.map((s, i) => (
              <div key={i}
                draggable
                onDragStart={() => { dragIdx.current = i }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx.current !== null && dragIdx.current !== i) {
                    moveSection(dragIdx.current, i)
                    dragIdx.current = null
                  }
                }}
                className="group rounded-xl border border-border p-4 space-y-2 cursor-grab active:cursor-grabbing"
                style={{ backgroundColor: 'var(--color-bg-primary)' }}
              >
                <div className="flex items-center gap-2">
                  {/* Drag handle */}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-ink-muted flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                    <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    value={s.heading}
                    onChange={e => updateSection(i, 'heading', e.target.value)}
                    placeholder="Título da seção…"
                    className="flex-1 text-[14px] font-semibold text-ink-primary outline-none bg-transparent placeholder:text-ink-muted"
                  />
                  <button onClick={() => removeSection(i)}
                    className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-400 transition-all text-[18px] leading-none">
                    ×
                  </button>
                </div>
                <textarea
                  value={s.body}
                  onChange={e => updateSection(i, 'body', e.target.value)}
                  placeholder="Conteúdo da seção…"
                  rows={3}
                  className="w-full text-sm text-ink-secondary leading-relaxed outline-none resize-none bg-transparent placeholder:text-ink-muted"
                />
              </div>
            ))}
          </div>
          <button onClick={addSection}
            className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted hover:text-ink-secondary transition-colors">
            <span className="text-[16px] leading-none">+</span> Adicionar seção
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {msg ? (
            <p className={`text-[12px] ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>{msg.text}</p>
          ) : (
            <p className="text-[12px] text-ink-muted">As edições ficam pendentes até aprovação.</p>
          )}
          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-xl text-[13px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-ui-strong)' }}>
            {saving ? 'Enviando…' : 'Enviar para revisão'}
          </button>
        </div>

      </div>
    </div>
  )
}
