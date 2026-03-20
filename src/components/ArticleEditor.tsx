'use client'
import { useState, useEffect, useRef } from 'react'
import { NewsItem } from '@/lib/types'

interface Props {
  item: NewsItem
  onClose: () => void
  onSaved: () => void
}

// Convert NewsItem sections to Editor.js blocks
function itemToBlocks(item: NewsItem): any[] {
  const blocks: any[] = []

  // Title as header
  blocks.push({ type: 'header', data: { text: item.title, level: 1 } })

  // Summary as paragraph
  if (item.summary) {
    blocks.push({ type: 'paragraph', data: { text: item.summary } })
  }

  // Image if exists
  if (item.imageUrl) {
    blocks.push({
      type: 'image',
      data: {
        file: { url: item.imageUrl },
        caption: '',
        withBorder: false,
        stretched: true,
        withBackground: false,
      }
    })
  }

  // Sections as header + paragraph pairs
  for (const s of item.sections || []) {
    if (s.heading) blocks.push({ type: 'header', data: { text: s.heading, level: 2 } })
    if (s.body)    blocks.push({ type: 'paragraph', data: { text: s.body } })
  }

  return blocks
}

// Convert Editor.js blocks back to NewsItem fields
function blocksToChanges(blocks: any[], original: NewsItem) {
  const changes: any = {}
  let title = ''
  let summary = ''
  let imageUrl: string | undefined
  const sections: { heading: string; body: string }[] = []

  let pendingHeading = ''

  for (const block of blocks) {
    if (block.type === 'header' && block.data.level === 1) {
      title = block.data.text?.replace(/<[^>]+>/g, '') || ''
    } else if (block.type === 'header' && block.data.level === 2) {
      if (pendingHeading) sections.push({ heading: pendingHeading, body: '' })
      pendingHeading = block.data.text?.replace(/<[^>]+>/g, '') || ''
    } else if (block.type === 'paragraph') {
      const text = block.data.text?.replace(/<[^>]+>/g, '') || ''
      if (!summary && !pendingHeading) {
        summary = text
      } else if (pendingHeading) {
        sections.push({ heading: pendingHeading, body: text })
        pendingHeading = ''
      } else {
        // Extra paragraphs after summary — attach to last section or create one
        if (sections.length > 0) {
          sections[sections.length - 1].body += (sections[sections.length - 1].body ? '\n' : '') + text
        }
      }
    } else if (block.type === 'image') {
      imageUrl = block.data.file?.url
    }
  }

  if (pendingHeading) sections.push({ heading: pendingHeading, body: '' })

  if (title && title !== original.title) changes.title = title
  if (summary && summary !== original.summary) changes.summary = summary
  if (imageUrl && imageUrl !== original.imageUrl) changes.imageUrl = imageUrl
  if (JSON.stringify(sections) !== JSON.stringify(original.sections || [])) changes.sections = sections

  return changes
}

export function ArticleEditor({ item, onClose, onSaved }: Props) {
  const editorRef = useRef<any>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!holderRef.current || editorRef.current) return

    // Dynamic import to avoid SSR issues
    const init = async () => {
      const EditorJS    = (await import('@editorjs/editorjs')).default
      const Header      = (await import('@editorjs/header')).default
      const List        = (await import('@editorjs/list')).default
      const Quote       = (await import('@editorjs/quote')).default
      const Delimiter   = (await import('@editorjs/delimiter')).default
      const ImageTool   = (await import('@editorjs/image')).default

      editorRef.current = new EditorJS({
        holder: holderRef.current!,
        data: { blocks: itemToBlocks(item) },
        placeholder: 'Comece a editar…',
        tools: {
          header: {
            class: Header,
            config: { levels: [1, 2, 3], defaultLevel: 2 },
          },
          list: {
            class: List,
            inlineToolbar: true,
          },
          quote: {
            class: Quote,
            inlineToolbar: true,
          },
          delimiter: Delimiter,
          image: {
            class: ImageTool,
            config: {
              // Upload via URL — use our proxy endpoint or direct
              uploader: {
                uploadByUrl: async (url: string) => {
                  return { success: 1, file: { url } }
                },
                uploadByFile: async (file: File) => {
                  // Convert to base64 data URL for preview — not persisted
                  return new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve({ success: 1, file: { url: reader.result as string } })
                    reader.readAsDataURL(file)
                  })
                }
              }
            }
          },
        },
        onReady: () => setReady(true),
        i18n: {
          messages: {
            ui: {
              blockTunes: { toggler: { 'Click to tune': 'Opções', 'or drag to move': 'ou arraste' } },
              inlineToolbar: { converter: { 'Convert to': 'Converter para' } },
              toolbar: { toolbox: { Add: 'Adicionar' } },
            },
            toolNames: {
              Text: 'Parágrafo', Heading: 'Título', List: 'Lista',
              Quote: 'Citação', Delimiter: 'Divisor', Image: 'Imagem',
              Bold: 'Negrito', Italic: 'Itálico', Link: 'Link',
            },
            tools: {
              list: { Ordered: 'Numerada', Unordered: 'Com marcadores' },
              header: { 'Heading 1': 'Título 1', 'Heading 2': 'Título 2', 'Heading 3': 'Título 3' },
              image: {
                'Select an Image': 'Selecionar imagem',
                'With border': 'Com borda',
                'Stretch image': 'Esticar imagem',
                'With background': 'Com fundo',
              },
            },
            blockTunes: {
              delete: { Delete: 'Deletar', 'Click to delete': 'Clique para deletar' },
              moveUp: { 'Move up': 'Mover para cima' },
              moveDown: { 'Move down': 'Mover para baixo' },
            },
          }
        },
      })
    }

    init().catch(console.error)

    return () => {
      editorRef.current?.destroy?.()
      editorRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!editorRef.current) return
    setSaving(true); setMsg(null)

    try {
      const output = await editorRef.current.save()
      const changes = blocksToChanges(output.blocks, item)

      if (Object.keys(changes).length === 0) {
        setMsg({ text: 'Nenhuma alteração detectada.', ok: false })
        setSaving(false); return
      }

      const res = await fetch('/api/community/edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: item.id,
          original: {
            title: item.title,
            summary: item.summary,
            sections: item.sections || [],
            imageUrl: item.imageUrl,
          },
          changes,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setMsg({ text: 'Edição enviada para aprovação!', ok: true })
        setTimeout(() => onSaved(), 1500)
      } else {
        setMsg({ text: data.error || 'Erro ao enviar.', ok: false })
      }
    } catch (e) {
      setMsg({ text: 'Erro ao salvar.', ok: false })
    }

    setSaving(false)
  }

  return (
    <div className="border-b border-border" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-tertiary">
            Modo edição
          </span>
          {!ready && <span className="text-[11px] text-ink-muted">Carregando editor…</span>}
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-[12px] ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>
              {msg.text}
            </span>
          )}
          <button onClick={onClose}
            className="text-[12px] text-ink-muted hover:text-ink-secondary transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !ready}
            className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-ui-strong)' }}>
            {saving ? 'Enviando…' : 'Enviar para revisão'}
          </button>
        </div>
      </div>

      {/* Editor.js holder */}
      <div className="px-8 py-6 max-w-3xl mx-auto">
        <div
          ref={holderRef}
          id="editorjs-holder"
          className="min-h-[300px] prose-editor"
        />
      </div>

      {/* Editor.js styles */}
      <style>{`
        .ce-block__content, .ce-toolbar__content { max-width: 100% !important; }
        .cdx-block { color: var(--color-ink-primary); }
        .ce-paragraph { font-size: 0.9375rem; line-height: 1.7; color: var(--color-ink-secondary); }
        .ce-header { color: var(--color-ink-primary); }
        h1.ce-header { font-size: 1.75rem; font-weight: 700; }
        h2.ce-header { font-size: 1.2rem; font-weight: 600; }
        h3.ce-header { font-size: 1rem; font-weight: 600; }
        .ce-toolbar__plus, .ce-toolbar__settings-btn { color: var(--color-ink-muted) !important; }
        .ce-toolbar__plus:hover, .ce-toolbar__settings-btn:hover { color: var(--color-ink-primary) !important; background: var(--color-bg-tertiary) !important; }
        .ce-toolbox, .ce-settings { background: var(--color-bg-secondary) !important; border-color: var(--color-border) !important; }
        .ce-toolbox__button, .ce-settings__button { color: var(--color-ink-secondary) !important; }
        .ce-toolbox__button:hover, .ce-settings__button:hover { background: var(--color-bg-tertiary) !important; }
        .cdx-search-field__input { background: var(--color-bg-tertiary) !important; color: var(--color-ink-primary) !important; }
        .ce-inline-toolbar { background: var(--color-bg-secondary) !important; border-color: var(--color-border) !important; }
        .ce-inline-tool, .ce-inline-toolbar__dropdown { color: var(--color-ink-secondary) !important; }
        .ce-inline-tool:hover { background: var(--color-bg-tertiary) !important; }
        .ce-inline-tool--active { color: var(--color-accent) !important; }
        .cdx-quote { border-left: 3px solid var(--color-accent); padding-left: 1rem; }
        .cdx-delimiter::before { color: var(--color-ink-muted); }
        .image-tool__image-picture { border-radius: 0.75rem; }
      `}</style>
    </div>
  )
}
