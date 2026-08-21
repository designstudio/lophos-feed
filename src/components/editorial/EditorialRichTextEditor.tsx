'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold01,
  ImagePlus,
  Italic01,
  Link01,
  List,
  Strikethrough01,
  Underline01,
} from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { EditorialImage } from './editorial-image-extension'
import type { EditorialDocument, EditorialImageAttributes, EditorialLinkAttributes } from './editorial-types'

type Props = {
  content: EditorialDocument
  onChange: (content: EditorialDocument) => void
  onUploadImage: (file: File) => Promise<string>
  onImageSelectionChange: (image: EditorialImageAttributes | null) => void
  onLinkSelectionChange: (link: EditorialLinkAttributes | null) => void
}

export type EditorialRichTextEditorHandle = {
  updateSelectedImage: (patch: Partial<EditorialImageAttributes>) => void
  deleteSelectedImage: () => void
  clearImageSelection: () => void
  applySelectedLink: (href: string) => void
  removeSelectedLink: () => void
  clearLinkSelection: () => void
}

function getSelectedImage(editor: Editor): EditorialImageAttributes | null {
  const selection = editor.state.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'editorialImage') return null
  const attrs = selection.node.attrs
  return {
    src: typeof attrs.src === 'string' ? attrs.src : '',
    alt: typeof attrs.alt === 'string' ? attrs.alt : '',
    credit: typeof attrs.credit === 'string' ? attrs.credit : '',
  }
}

function getSelectedLink(editor: Editor): EditorialLinkAttributes | null {
  if (!editor.isActive('link')) return null
  const attrs = editor.getAttributes('link')
  return { href: typeof attrs.href === 'string' ? attrs.href : '' }
}

function ToolButton({ active, label, onClick, children }: {
  active?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-bg-tertiary hover:text-ink-primary',
        active && 'bg-bg-tertiary text-ink-primary',
      )}
    >
      {children}
    </button>
  )
}

function NumberedListIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12L9 12M21 6L9 6M21 18L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10V5L3 6.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 15.6667C3 15.2246 3.15804 14.8007 3.43934 14.4882C3.72064 14.1756 4.10218 14 4.5 14C4.89782 14 5.27936 14.1756 5.56066 14.4882C5.84196 14.8007 6 15.2246 6 15.6667C6 16.1592 5.625 16.5 5.25 16.9167L3 19H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function QuoteIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 12H16.3333M7 6H21M7 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 19L3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent
    parent = parent.parentElement
  }
  return null
}

export const EditorialRichTextEditor = forwardRef<EditorialRichTextEditorHandle, Props>(function EditorialRichTextEditor({ content, onChange, onUploadImage, onImageSelectionChange, onLinkSelectionChange }, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolbarSentinelRef = useRef<HTMLDivElement>(null)
  const toolbarReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasBeenStickyRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [toolbarState, setToolbarState] = useState<'resting' | 'stuck' | 'released'>('resting')
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Comece a escrever a lista…' }),
      EditorialImage,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'editorial-editor-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON() as EditorialDocument)
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const selectedImage = getSelectedImage(currentEditor)
      onImageSelectionChange(selectedImage)
      onLinkSelectionChange(selectedImage ? null : getSelectedLink(currentEditor))
    },
  })

  useImperativeHandle(ref, () => ({
    updateSelectedImage(patch) {
      if (!editor) return
      const selectedImage = getSelectedImage(editor)
      if (!selectedImage) return
      editor.commands.updateAttributes('editorialImage', patch)
      onImageSelectionChange({ ...selectedImage, ...patch })
    },
    deleteSelectedImage() {
      if (!editor || !getSelectedImage(editor)) return
      editor.chain().focus().deleteSelection().run()
      onImageSelectionChange(null)
    },
    clearImageSelection() {
      if (!editor || !getSelectedImage(editor)) return
      const nextSelection = TextSelection.near(editor.state.doc.resolve(editor.state.selection.to), 1)
      editor.view.dispatch(editor.state.tr.setSelection(nextSelection))
      onImageSelectionChange(null)
    },
    applySelectedLink(href) {
      if (!editor) return
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
      onLinkSelectionChange({ href })
    },
    removeSelectedLink() {
      if (!editor) return
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      onLinkSelectionChange(null)
    },
    clearLinkSelection() {
      onLinkSelectionChange(null)
    },
  }), [editor, onImageSelectionChange, onLinkSelectionChange])

  useEffect(() => {
    const sentinel = toolbarSentinelRef.current
    if (!sentinel) return

    const scrollParent = getScrollParent(sentinel)
    const observer = new IntersectionObserver(([entry]) => {
      const rootTop = entry.rootBounds?.top ?? 0
      const isStuck = !entry.isIntersecting && entry.boundingClientRect.top < rootTop

      if (isStuck) {
        if (toolbarReleaseTimerRef.current) clearTimeout(toolbarReleaseTimerRef.current)
        hasBeenStickyRef.current = true
        setToolbarState('stuck')
        return
      }

      if (!hasBeenStickyRef.current) return
      setToolbarState('released')
      toolbarReleaseTimerRef.current = setTimeout(() => setToolbarState('resting'), 150)
    }, { root: scrollParent, threshold: 0 })

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      if (toolbarReleaseTimerRef.current) clearTimeout(toolbarReleaseTimerRef.current)
    }
  }, [editor])

  const openLinkInspector = () => {
    if (!editor) return
    onLinkSelectionChange(getSelectedLink(editor) || { href: '' })
  }

  const uploadInlineImage = async (file: File) => {
    if (!editor) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await onUploadImage(file)
      const insertionPosition = editor.state.selection.from
      editor.chain().focus().insertContent({ type: 'editorialImage', attrs: { src: url, alt: '', credit: '' } }).run()
      editor.commands.setNodeSelection(insertionPosition)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!editor) return <div className="min-h-[32rem] animate-pulse bg-bg-secondary" />

  return (
    <div>
      <div ref={toolbarSentinelRef} className="editorial-toolbar-sentinel" aria-hidden="true" />
      <div className="editorial-toolbar" data-state={toolbarState} role="toolbar" aria-label="Formatação do texto">
        <ToolButton label="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold01 size={18} /></ToolButton>
        <ToolButton label="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic01 size={18} /></ToolButton>
        <ToolButton label="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline01 size={18} /></ToolButton>
        <ToolButton label="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough01 size={18} /></ToolButton>
        <ToolButton label="Link" active={editor.isActive('link')} onClick={openLinkInspector}><Link01 size={18} /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></ToolButton>
        <ToolButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><NumberedListIcon /></ToolButton>
        <ToolButton label="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><QuoteIcon /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolButton label={uploading ? 'Enviando imagem' : 'Inserir imagem'} onClick={() => fileInputRef.current?.click()}><ImagePlus size={18} /></ToolButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadInlineImage(file)
          }}
        />
      </div>
      {uploadError ? <p className="px-8 pt-4 text-sm text-[var(--color-danger)]">{uploadError}</p> : null}
      <EditorContent editor={editor} />
    </div>
  )
})
