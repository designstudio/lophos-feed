'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Save01 } from '@untitledui/icons'
import { AppToast, type AppToastMessage } from '@/components/AppToast'
import { EditorialInspector } from './EditorialInspector'
import { EditorialPreview } from './EditorialPreview'
import { EditorialRichTextEditor, type EditorialRichTextEditorHandle } from './EditorialRichTextEditor'
import {
  EMPTY_EDITORIAL_DOCUMENT,
  type EditorialDraft,
  type EditorialImageAttributes,
  type EditorialListRecord,
} from './editorial-types'

const EMPTY_DRAFT: EditorialDraft = {
  title: '',
  slug: '',
  contentJson: EMPTY_EDITORIAL_DOCUMENT,
  coverImageUrl: '',
  coverImageAlt: '',
  coverImageCredit: '',
  topic: '',
  topics: [],
  seoTags: [],
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
}

function EditorialTitleField({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const title = titleRef.current
    if (!title) return
    title.style.height = 'auto'
    title.style.height = `${title.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={titleRef}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={180}
      className="editorial-title-input"
      placeholder="Título da lista"
      aria-label="Título da lista"
    />
  )
}

function recordToDraft(record: EditorialListRecord): EditorialDraft {
  return {
    title: record.title,
    slug: record.slug,
    contentJson: record.content_json,
    coverImageUrl: record.cover_image_url || '',
    coverImageAlt: record.cover_image_alt || '',
    coverImageCredit: record.cover_image_credit || '',
    topic: record.topic,
    topics: record.matched_topics || [],
    seoTags: record.keywords || [],
    seoTitle: record.seo_title || '',
    seoDescription: record.seo_description || '',
    status: record.status,
  }
}

export function EditorialListEditor({ listId, currentAuthor }: {
  listId?: string
  currentAuthor: { name: string; imageUrl: string | null }
}) {
  const router = useRouter()
  const richTextEditorRef = useRef<EditorialRichTextEditorHandle>(null)
  const [draft, setDraft] = useState<EditorialDraft>(EMPTY_DRAFT)
  const [record, setRecord] = useState<EditorialListRecord | null>(null)
  const [loading, setLoading] = useState(Boolean(listId))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<AppToastMessage | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<EditorialImageAttributes | null>(null)

  useEffect(() => {
    try {
      const pendingToast = sessionStorage.getItem('lophos_admin_list_toast')
      if (!pendingToast) return
      sessionStorage.removeItem('lophos_admin_list_toast')
      setToast(JSON.parse(pendingToast) as AppToastMessage)
    } catch {}
  }, [])

  useEffect(() => {
    if (!listId) return
    fetch(`/api/admin/lists/${listId}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a lista.')
        return data.list as EditorialListRecord
      })
      .then((list) => {
        setRecord(list)
        setDraft(recordToDraft(list))
      })
      .catch((loadError) => setLoadError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a lista.'))
      .finally(() => setLoading(false))
  }, [listId])

  const updateDraft = useCallback((patch: Partial<EditorialDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }, [])

  const uploadImage = useCallback(async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/admin/lists/upload', { method: 'POST', body: formData })
    const data = await response.json()
    if (!response.ok) {
      const error = new Error(data.error || 'Não foi possível enviar a imagem.')
      setToast({ type: 'error', text: error.message })
      throw error
    }
    setToast({ type: 'success', text: 'Imagem enviada.' })
    return data.image.url as string
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = draft.slug ? draft : { ...draft, slug: undefined }
      const response = await fetch(listId ? `/api/admin/lists/${listId}` : '/api/admin/lists', {
        method: listId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a lista.')
      const saved = data.list as EditorialListRecord
      setRecord(saved)
      setDraft(recordToDraft(saved))
      setDirty(false)
      const successMessage: AppToastMessage = {
        type: 'success',
        text: saved.status === 'published'
          ? record?.status === 'published' ? 'Lista atualizada.' : 'Lista publicada.'
          : 'Alterações salvas.',
      }
      if (!listId) {
        try { sessionStorage.setItem('lophos_admin_list_toast', JSON.stringify(successMessage)) } catch {}
        router.replace(`/admin/lists/${saved.id}`)
      } else {
        setToast(successMessage)
      }
    } catch (saveError) {
      setToast({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Não foi possível salvar a lista.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="flex flex-1 items-center justify-center text-sm text-ink-muted">Carregando editor…</main>
  }

  const authorName = record?.author_name || currentAuthor.name
  const authorImageUrl = record?.author_image_url || currentAuthor.imageUrl
  const isPublished = record?.status === 'published'
  const primaryActionLabel = saving
    ? 'Salvando…'
    : draft.status === 'draft'
      ? 'Salvar'
      : draft.status === 'published'
        ? isPublished ? 'Atualizar' : 'Publicar'
        : 'Salvar'
  const statusLabel = saving
    ? 'Salvando…'
    : dirty
      ? 'Não salvo'
      : draft.status === 'published'
        ? 'Publicado'
        : draft.status === 'archived'
          ? 'Arquivado'
          : 'Rascunho'

  return (
    <main className="editorial-cms-shell">
      <header className="editorial-cms-header">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/lists" className="editorial-back-button" aria-label="Voltar para listas"><ArrowLeft size={17} /></Link>
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-sm font-medium text-ink-primary">Nova lista</h1>
            <span className="h-1 w-1 flex-none rounded-full bg-ink-muted" aria-hidden="true" />
            <span className="truncate text-sm text-ink-muted">{statusLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Preview" onClick={() => setPreviewOpen(true)} className="editorial-secondary-button"><Eye size={17} /><span className="hidden sm:inline">Preview</span></button>
          <button type="button" disabled={saving} onClick={() => void save()} className="editorial-primary-button"><Save01 size={17} />{primaryActionLabel}</button>
        </div>
      </header>

      {loadError ? <div className="border-b border-border bg-[var(--color-danger-hover)] px-5 py-3 text-center text-sm text-[var(--color-danger)]">{loadError}</div> : null}

      <div className="editorial-cms-body">
        <section className="editorial-writing-area">
          <div className="editorial-writing-page">
            <EditorialTitleField
              value={draft.title}
              onChange={(title) => updateDraft({ title })}
            />
            <div className="mb-8 flex items-center gap-3 px-8 md:px-12">
              {authorImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authorImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : <div className="h-8 w-8 rounded-full bg-bg-tertiary" />}
              <div>
                <p className="text-sm font-medium text-ink-primary">{authorName}</p>
                <p className="text-xs text-ink-muted">Editor Lophos</p>
              </div>
            </div>
            <EditorialRichTextEditor
              key={record?.id || 'new-list'}
              ref={richTextEditorRef}
              content={draft.contentJson}
              onChange={(contentJson) => updateDraft({ contentJson })}
              onUploadImage={uploadImage}
              onImageSelectionChange={setSelectedImage}
            />
          </div>
        </section>
        <EditorialInspector
          draft={draft}
          selectedImage={selectedImage}
          onChange={updateDraft}
          onUploadImage={uploadImage}
          onUpdateSelectedImage={(patch) => richTextEditorRef.current?.updateSelectedImage(patch)}
          onDeleteSelectedImage={() => richTextEditorRef.current?.deleteSelectedImage()}
          onCloseImageInspector={() => richTextEditorRef.current?.clearImageSelection()}
        />
      </div>

      {previewOpen ? <EditorialPreview draft={draft} authorName={authorName} authorImageUrl={authorImageUrl} publishedAt={record?.published_at} onClose={() => setPreviewOpen(false)} /> : null}
      <AppToast message={toast} onDismiss={() => setToast(null)} />
    </main>
  )
}
