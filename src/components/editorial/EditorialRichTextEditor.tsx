'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold01,
  Heading02,
  ImagePlus,
  Italic01,
  Link01,
  List,
  Menu02,
  Annotation,
} from '@untitledui/icons'
import { cn } from '@/lib/utils'
import { EditorialImage } from './editorial-image-extension'
import type { EditorialDocument, EditorialImageAttributes } from './editorial-types'

type Props = {
  content: EditorialDocument
  onChange: (content: EditorialDocument) => void
  onUploadImage: (file: File) => Promise<string>
  onImageSelectionChange: (image: EditorialImageAttributes | null) => void
}

export type EditorialRichTextEditorHandle = {
  updateSelectedImage: (patch: Partial<EditorialImageAttributes>) => void
  deleteSelectedImage: () => void
  clearImageSelection: () => void
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
        'flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-bg-tertiary hover:text-ink-primary',
        active && 'bg-bg-tertiary text-ink-primary',
      )}
    >
      {children}
    </button>
  )
}

export const EditorialRichTextEditor = forwardRef<EditorialRichTextEditorHandle, Props>(function EditorialRichTextEditor({ content, onChange, onUploadImage, onImageSelectionChange }, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
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
      onImageSelectionChange(getSelectedImage(currentEditor))
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
  }), [editor, onImageSelectionChange])

  const addLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Cole o endereço do link:', previousUrl || 'https://')
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
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
      <div className="editorial-toolbar" role="toolbar" aria-label="Formatação do texto">
        <ToolButton label="Título" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading02 size={18} /></ToolButton>
        <ToolButton label="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold01 size={18} /></ToolButton>
        <ToolButton label="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic01 size={18} /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={18} /></ToolButton>
        <ToolButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><Menu02 size={18} /></ToolButton>
        <ToolButton label="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Annotation size={18} /></ToolButton>
        <ToolButton label="Link" active={editor.isActive('link')} onClick={addLink}><Link01 size={18} /></ToolButton>
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
