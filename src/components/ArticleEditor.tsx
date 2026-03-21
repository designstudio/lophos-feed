'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { NewsItem, ArticleSection } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'image'

interface Block {
  id: string
  type: BlockType
  content: string   // HTML for text blocks, URL for image
  caption?: string  // for image blocks
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Convert NewsItem → Blocks ────────────────────────────────
function itemToBlocks(item: NewsItem): Block[] {
  const blocks: Block[] = []
  blocks.push({ id: uid(), type: 'h1', content: item.title })
  if (item.imageUrl) {
    blocks.push({ id: uid(), type: 'image', content: item.imageUrl, caption: item.sources?.[0]?.name })
  }
  if (item.summary) {
    blocks.push({ id: uid(), type: 'paragraph', content: item.summary })
  }
  for (const s of item.sections || []) {
    if (s.heading) blocks.push({ id: uid(), type: 'h2', content: s.heading })
    if (s.body)    blocks.push({ id: uid(), type: 'paragraph', content: s.body })
  }
  return blocks
}

// ─── Convert Blocks → changes ────────────────────────────────
function blocksToChanges(blocks: Block[], original: NewsItem) {
  const changes: any = {}
  const h1 = blocks.find(b => b.type === 'h1')
  const imgBlock = blocks.find(b => b.type === 'image')
  const textBlocks = blocks.filter(b => b.type !== 'h1' && b.type !== 'image')

  const title = h1?.content.replace(/<[^>]+>/g, '').trim() || ''
  if (title && title !== original.title) changes.title = title

  const imageUrl = imgBlock?.content.trim()
  if (imageUrl && imageUrl !== original.imageUrl) changes.imageUrl = imageUrl
  if (!imageUrl && original.imageUrl) changes.imageUrl = null

  // Rebuild summary + sections
  let summary = ''
  const sections: ArticleSection[] = []
  let pendingHeading = ''

  for (const b of textBlocks) {
    const text = b.content.replace(/<[^>]+>/g, '').trim()
    if (!text) continue
    if (b.type === 'h2' || b.type === 'h3') {
      if (pendingHeading) sections.push({ heading: pendingHeading, body: '' })
      pendingHeading = text
    } else {
      if (!summary && !pendingHeading) {
        summary = b.content.trim()
      } else {
        sections.push({ heading: pendingHeading, body: b.content.trim() })
        pendingHeading = ''
      }
    }
  }
  if (pendingHeading) sections.push({ heading: pendingHeading, body: '' })

  if (summary && summary !== original.summary) changes.summary = summary
  if (JSON.stringify(sections) !== JSON.stringify(original.sections || [])) changes.sections = sections

  return changes
}

// ─── Toolbar (floating, on selection) ────────────────────────
function FloatingToolbar({ onFormat }: { onFormat: (cmd: string, val?: string) => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onSelect = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setPos(null); return }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
      setLinkMode(false)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPos(null)
    }
    document.addEventListener('selectionchange', onSelect)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('selectionchange', onSelect)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  if (!pos) return null

  const btn = (cmd: string, label: React.ReactNode, title: string, val?: string) => (
    <button
      onMouseDown={e => { e.preventDefault(); onFormat(cmd, val) }}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded transition-colors text-[13px] font-medium"
      style={{ color: 'var(--color-ink-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >{label}</button>
  )

  return (
    <div ref={ref} className="fixed z-[9999] flex items-center gap-0.5 rounded-xl border shadow-xl px-1.5 py-1"
      style={{
        left: pos.x, top: pos.y,
        transform: 'translate(-50%, -100%)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        animation: 'slideUp 0.1s ease',
      }}>
      {!linkMode ? (
        <>
          {btn('bold', <b>B</b>, 'Negrito (Cmd+B)')}
          {btn('italic', <i>I</i>, 'Itálico (Cmd+I)')}
          {btn('underline', <u>U</u>, 'Sublinhado (Cmd+U)')}
          <div className="w-px h-4 mx-0.5" style={{ background: 'var(--color-border)' }} />
          <button
            onMouseDown={e => { e.preventDefault(); setLinkMode(true) }}
            title="Link"
            className="w-7 h-7 flex items-center justify-center rounded transition-colors"
            style={{ color: 'var(--color-ink-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 7.5a3 3 0 0 0 4.243.007l1.5-1.5a3 3 0 0 0-4.243-4.243L5.35 2.914"/>
              <path d="M8 5.5a3 3 0 0 0-4.243-.007l-1.5 1.5a3 3 0 0 0 4.243 4.243l1.15-1.15"/>
            </svg>
          </button>
        </>
      ) : (
        <div className="flex items-center gap-1.5 px-1">
          <input autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="text-[12px] outline-none bg-transparent w-40"
            style={{ color: 'var(--color-ink-primary)' }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); onFormat('createLink', linkUrl); setPos(null) }
              if (e.key === 'Escape') setLinkMode(false)
            }}
          />
          <button onMouseDown={e => { e.preventDefault(); onFormat('createLink', linkUrl); setPos(null) }}
            className="text-[11px] font-medium px-2 py-0.5 rounded-lg text-white"
            style={{ background: 'var(--color-accent)' }}>Ok</button>
        </div>
      )}
    </div>
  )
}

// ─── Block Type Menu ──────────────────────────────────────────
const BLOCK_TYPES: { type: BlockType; label: string; desc: string }[] = [
  { type: 'paragraph', label: 'Texto',         desc: 'Parágrafo simples' },
  { type: 'h1',        label: 'Título 1',      desc: 'Título grande' },
  { type: 'h2',        label: 'Título 2',      desc: 'Título médio' },
  { type: 'h3',        label: 'Título 3',      desc: 'Título pequeno' },
  { type: 'ul',        label: 'Lista',         desc: 'Lista com marcadores' },
  { type: 'ol',        label: 'Lista numerada',desc: 'Lista numerada' },
  { type: 'quote',     label: 'Citação',       desc: 'Bloco de citação' },
  { type: 'image',     label: 'Imagem',        desc: 'Imagem por URL' },
]

function BlockTypeMenu({ pos, current, onSelect, onClose }: {
  pos: { x: number; y: number }
  current: BlockType
  onSelect: (t: BlockType) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h))
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="fixed z-[9998] w-48 rounded-xl border shadow-xl py-1"
      style={{ left: pos.x, top: pos.y, backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', animation: 'slideUp 0.1s ease' }}>
      {BLOCK_TYPES.map(t => (
        <button key={t.type} onClick={() => { onSelect(t.type); onClose() }}
          className="flex items-center justify-between w-full px-3 py-2 text-left transition-colors"
          style={{ backgroundColor: t.type === current ? 'var(--color-bg-tertiary)' : 'transparent' }}
          onMouseEnter={e => { if (t.type !== current) e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)' }}
          onMouseLeave={e => { if (t.type !== current) e.currentTarget.style.backgroundColor = 'transparent' }}>
          <span className="text-[13px]" style={{ color: 'var(--color-ink-primary)' }}>{t.label}</span>
          <span className="text-[11px]" style={{ color: 'var(--color-ink-tertiary)' }}>{t.desc}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Single Block ─────────────────────────────────────────────
function EditorBlock({ block, index, total, onChange, onAddAfter, onDelete, onMove, onChangeType }: {
  block: Block
  index: number
  total: number
  onChange: (id: string, content: string) => void
  onAddAfter: (id: string) => void
  onDelete: (id: string) => void
  onMove: (from: number, to: number) => void
  onChangeType: (id: string, type: BlockType) => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [typeMenuPos, setTypeMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [imgUrl, setImgUrl] = useState(block.content)
  const [imgInput, setImgInput] = useState(block.content)
  const dragRef = useRef(false)

  // Sync content on mount
  useEffect(() => {
    if (contentRef.current && block.type !== 'image') {
      if (contentRef.current.innerHTML !== block.content) {
        contentRef.current.innerHTML = block.content
      }
    }
  }, [block.type]) // only on type change

  const handleInput = () => {
    if (contentRef.current) onChange(block.id, contentRef.current.innerHTML)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onAddAfter(block.id)
    }
    if (e.key === 'Backspace') {
      const el = contentRef.current
      if (el && el.innerText.trim() === '' && total > 1) {
        e.preventDefault()
        onDelete(block.id)
      }
    }
    // Slash command — show type menu
    if (e.key === '/' && contentRef.current?.innerText === '') {
      e.preventDefault()
      const rect = contentRef.current!.getBoundingClientRect()
      setTypeMenuPos({ x: rect.left, y: rect.bottom + 4 })
    }
  }

  const blockClass = {
    paragraph: 'text-[0.9375rem] leading-relaxed',
    h1: 'text-[2rem] font-bold leading-tight',
    h2: 'text-[1.25rem] font-semibold leading-snug',
    h3: 'text-[1.05rem] font-semibold leading-snug',
    ul: 'text-[0.9375rem] leading-relaxed list-disc ml-5',
    ol: 'text-[0.9375rem] leading-relaxed list-decimal ml-5',
    quote: 'text-[0.9375rem] leading-relaxed italic pl-4 border-l-2',
  }[block.type as Exclude<BlockType, 'image'>]

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left controls */}
      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Block type button */}
        <button
          onClick={e => {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            setTypeMenuPos({ x: rect.left, y: rect.bottom + 4 })
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-medium transition-colors"
          style={{ color: 'var(--color-ink-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
          title="Tipo de bloco"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h10M2 7h10M2 10h10"/>
          </svg>
        </button>
        {/* Drag handle */}
        <div
          draggable
          onDragStart={e => { dragRef.current = true; e.dataTransfer.setData('blockIndex', String(index)) }}
          onDragEnd={() => { dragRef.current = false }}
          className="w-6 h-6 flex items-center justify-center rounded cursor-grab active:cursor-grabbing transition-colors"
          style={{ color: 'var(--color-ink-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
          title="Arrastar bloco"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="4" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/>
            <circle cx="4" cy="6" r="1.2"/><circle cx="8" cy="6" r="1.2"/>
            <circle cx="4" cy="9" r="1.2"/><circle cx="8" cy="9" r="1.2"/>
          </svg>
        </div>
      </div>

      {/* Drop zone */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
        onDrop={e => {
          e.preventDefault()
          const from = parseInt(e.dataTransfer.getData('blockIndex'))
          if (!isNaN(from) && from !== index) onMove(from, index)
        }}
        style={{ pointerEvents: dragRef.current ? 'auto' : 'none' }}
      />

      {/* Image block */}
      {block.type === 'image' ? (
        <div className="my-2 space-y-2">
          {imgUrl && (
            <div className="rounded-xl overflow-hidden bg-bg-secondary relative">
              <img src={imgUrl} alt="" className="w-full object-cover" style={{ maxHeight: '400px' }}
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
            </div>
          )}
          <input
            value={imgInput}
            onChange={e => setImgInput(e.target.value)}
            onBlur={() => { setImgUrl(imgInput); onChange(block.id, imgInput) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setImgUrl(imgInput); onChange(block.id, imgInput) }}}
            placeholder="Cole a URL da imagem…"
            className="w-full text-[12px] px-3 py-2 rounded-lg border outline-none transition-colors"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-ink-primary)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          />
        </div>
      ) : (
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={block.type === 'paragraph' ? 'Escreva algo ou digite / para comandos…' : 'Título…'}
          className={`outline-none w-full py-1 empty-placeholder ${blockClass}`}
          style={{
            color: block.type === 'quote' ? 'var(--color-ink-secondary)' : 'var(--color-ink-primary)',
            borderLeftColor: block.type === 'quote' ? 'var(--color-accent)' : undefined,
            minHeight: '1.5em',
          }}
        />
      )}

      {/* Add block button */}
      {hovered && block.type !== 'image' && (
        <button
          onClick={() => onAddAfter(block.id)}
          className="absolute -right-8 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-[16px] leading-none transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--color-ink-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
          title="Adicionar bloco"
        >+</button>
      )}

      {/* Block type menu */}
      {typeMenuPos && (
        <BlockTypeMenu
          pos={typeMenuPos}
          current={block.type}
          onSelect={t => onChangeType(block.id, t)}
          onClose={() => setTypeMenuPos(null)}
        />
      )}
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────
interface Props {
  item: NewsItem
  onClose: () => void
  onSaved: () => void
  onSavingChange?: (v: boolean) => void
  onMsgChange?: (v: { text: string; ok: boolean } | null) => void
  saveRef?: React.MutableRefObject<(() => void) | null>
}

export function ArticleEditor({ item, onClose, onSaved, onSavingChange, onMsgChange, saveRef }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => itemToBlocks(item))
  const [saving, setSaving] = useState(false)
  const setSavingSync = (v: boolean) => { setSaving(v); onSavingChange?.(v) }
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const setMsgSync = (v: { text: string; ok: boolean } | null) => { setMsg(v); onMsgChange?.(v) }
  const focusIdRef = useRef<string | null>(null)

  const format = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
  }, [])

  const updateBlock = useCallback((id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
  }, [])

  const addAfter = useCallback((id: string) => {
    const newBlock: Block = { id: uid(), type: 'paragraph', content: '' }
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const arr = [...prev]
      arr.splice(idx + 1, 0, newBlock)
      return arr
    })
    focusIdRef.current = newBlock.id
  }, [])

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
  }, [])

  const moveBlock = useCallback((from: number, to: number) => {
    setBlocks(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }, [])

  const changeType = useCallback((id: string, type: BlockType) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type, content: type === 'image' ? '' : b.content } : b))
  }, [])

  // Focus newly added block
  useEffect(() => {
    if (!focusIdRef.current) return
    const id = focusIdRef.current
    focusIdRef.current = null
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement
      el?.focus()
    }, 20)
  }, [blocks])

  // Register save function with parent header button
  useEffect(() => {
    if (saveRef) saveRef.current = save
    return () => { if (saveRef) saveRef.current = null }
  })

  const save = async () => {
    setSavingSync(true); setMsgSync(null)
    const changes = blocksToChanges(blocks, item)
    if (Object.keys(changes).length === 0) {
      setMsgSync({ text: 'Nenhuma alteração detectada.', ok: false })
      setSavingSync(false); return
    }
    try {
      const res = await fetch('/api/community/edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: item.id,
          original: { title: item.title, summary: item.summary, sections: item.sections || [], imageUrl: item.imageUrl },
          changes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgSync({ text: 'Enviado para revisão!', ok: true })
        setTimeout(onSaved, 1500)
      } else {
        setMsgSync({ text: data.error || 'Erro ao enviar.', ok: false })
      }
    } catch { setMsgSync({ text: 'Erro ao enviar.', ok: false }) }
    setSavingSync(false)
  }

  return (
    <>
      <FloatingToolbar onFormat={format} />

      {/* Editor content — replaces the article body */}
      <div className="article-layout mx-auto py-6 px-8" style={{ paddingLeft: '5rem', paddingRight: '5rem' }}>
        {blocks.map((block, i) => (
          <div key={block.id} data-block-id={block.id}>
            <EditorBlock
              block={block}
              index={i}
              total={blocks.length}
              onChange={updateBlock}
              onAddAfter={addAfter}
              onDelete={deleteBlock}
              onMove={moveBlock}
              onChangeType={changeType}
            />
          </div>
        ))}
      </div>

      {/* Placeholder CSS */}
      <style>{`
        .empty-placeholder:empty:before {
          content: attr(data-placeholder);
          color: var(--color-ink-muted);
          pointer-events: none;
        }
      `}</style>

      {/* Expose save/msg to parent via custom event */}
      <div id="editor-state" data-saving={saving} data-msg={msg ? JSON.stringify(msg) : ''} style={{ display: 'none' }} />
    </>
  )
}

// Export save trigger for header button
export { type Block }
