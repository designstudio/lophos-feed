'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ImagePlus, Trash01, Upload01 } from '@untitledui/icons'
import type { EditorialDraft, EditorialImageAttributes, EditorialStatus } from './editorial-types'
import { EditorialTopicSelect } from './EditorialTopicSelect'

const fieldClass = 'w-full rounded-lg border border-border bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink-primary outline-none transition-shadow placeholder:text-ink-muted focus:border-border-strong focus:shadow-[0_0_0_3px_var(--input-halo)]'

function TagInput({ label, value, helper, placeholder = 'Separe com vírgulas', onChange }: {
  label: string
  value: string[]
  helper: string
  placeholder?: string
  onChange: (value: string[]) => void
}) {
  const [inputValue, setInputValue] = useState(value.join(', '))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setInputValue(value.join(', '))
  }, [value])

  const parseValue = (rawValue: string) => (
    [...new Set(rawValue.split(',').map((item) => item.trim()).filter(Boolean))]
  )

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink-primary">{label}</span>
      <input
        className={fieldClass}
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => { focusedRef.current = true }}
        onChange={(event) => {
          setInputValue(event.target.value)
          onChange(parseValue(event.target.value))
        }}
        onBlur={(event) => {
          focusedRef.current = false
          const parsed = parseValue(event.target.value)
          setInputValue(parsed.join(', '))
          onChange(parsed)
        }}
      />
      <span className="mt-1.5 block text-xs leading-relaxed text-ink-muted">{helper}</span>
    </label>
  )
}

export function EditorialInspector({
  draft,
  slugLocked,
  selectedImage,
  onChange,
  onUploadImage,
  onUpdateSelectedImage,
  onDeleteSelectedImage,
  onCloseImageInspector,
}: {
  draft: EditorialDraft
  slugLocked: boolean
  selectedImage: EditorialImageAttributes | null
  onChange: (patch: Partial<EditorialDraft>) => void
  onUploadImage: (file: File) => Promise<string>
  onUpdateSelectedImage: (patch: Partial<EditorialImageAttributes>) => void
  onDeleteSelectedImage: () => void
  onCloseImageInspector: () => void
}) {
  const coverInputRef = useRef<HTMLInputElement>(null)
  const listPageRef = useRef<HTMLDivElement>(null)
  const imagePageRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [scrollState, setScrollState] = useState({ canScrollUp: false, canScrollDown: false })
  const [inspectedImage, setInspectedImage] = useState<EditorialImageAttributes | null>(selectedImage)
  const showingImageInspector = Boolean(selectedImage)
  const activeImage = selectedImage || inspectedImage

  const updateScrollState = useCallback(() => {
    const inspector = showingImageInspector ? imagePageRef.current : listPageRef.current
    if (!inspector) return
    const overflowing = inspector.scrollHeight > inspector.clientHeight + 1
    setScrollState({
      canScrollUp: overflowing && inspector.scrollTop > 1,
      canScrollDown: overflowing && inspector.scrollTop + inspector.clientHeight < inspector.scrollHeight - 1,
    })
  }, [showingImageInspector])

  useEffect(() => {
    if (selectedImage) setInspectedImage(selectedImage)
  }, [selectedImage])

  useEffect(() => {
    const frame = requestAnimationFrame(updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [draft, selectedImage, updateScrollState])

  useEffect(() => {
    if (showingImageInspector && imagePageRef.current) imagePageRef.current.scrollTop = 0
    const frame = requestAnimationFrame(updateScrollState)
    return () => cancelAnimationFrame(frame)
  }, [showingImageInspector, updateScrollState])

  const uploadCover = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const url = await onUploadImage(file)
      onChange({ coverImageUrl: url })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível enviar a capa.')
    } finally {
      setUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  return (
    <div className="editorial-inspector-shell">
    <aside className="editorial-inspector t-page-slide" data-page={showingImageInspector ? '2' : '1'}>
      <div
        ref={imagePageRef}
        className="t-page editorial-inspector-page"
        data-page-id="2"
        aria-hidden={!showingImageInspector}
        inert={!showingImageInspector}
        onScroll={updateScrollState}
      >
      {activeImage ? (
        <>
          <section className="editorial-inspector-section">
            <button
              type="button"
              onClick={() => {
                onCloseImageInspector()
                requestAnimationFrame(() => listPageRef.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus())
              }}
              className="mb-5 flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"
            >
              <ArrowLeft size={16} />
              Configurações da lista
            </button>
            <h2 className="text-base font-semibold text-ink-primary">Imagem do conteúdo</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">Edite as informações exibidas junto desta imagem.</p>
            <div className="mt-4 overflow-hidden rounded-xl bg-bg-secondary">
              {/* Uploaded editorial URLs are generated by the trusted admin API. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeImage.src} alt="" className="aspect-[16/10] w-full object-cover" />
            </div>
          </section>

          <section className="editorial-inspector-section space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-primary">Crédito</span>
              <input
                className={fieldClass}
                value={activeImage.credit}
                placeholder="Fotógrafo, artista ou fonte"
                onChange={(event) => onUpdateSelectedImage({ credit: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink-primary">Texto alternativo</span>
              <textarea
                rows={3}
                className={`${fieldClass} resize-none`}
                value={activeImage.alt}
                placeholder="Descreva a imagem para acessibilidade"
                onChange={(event) => onUpdateSelectedImage({ alt: event.target.value })}
              />
              <span className="mt-1.5 block text-xs leading-relaxed text-ink-muted">Usado por leitores de tela e quando a imagem não carrega.</span>
            </label>
          </section>

          <section className="editorial-inspector-section">
            <button
              type="button"
              onClick={onDeleteSelectedImage}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-hover)]"
            >
              <Trash01 size={16} />
              Remover imagem
            </button>
          </section>
        </>
      ) : null}
      </div>

      <div
        ref={listPageRef}
        className="t-page editorial-inspector-page"
        data-page-id="1"
        aria-hidden={showingImageInspector}
        inert={showingImageInspector}
        onScroll={updateScrollState}
      >
      <section className="editorial-inspector-section">
        <h2 className="text-sm font-semibold text-ink-primary">Capa</h2>
        {draft.coverImageUrl ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.coverImageUrl} alt="Preview da capa" className="aspect-[16/10] w-full object-cover" />
            <div className="flex gap-2 p-2">
              <button type="button" onClick={() => coverInputRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary"><Upload01 size={15} /> Trocar</button>
              <button type="button" onClick={() => onChange({ coverImageUrl: '', coverImageAlt: '', coverImageCredit: '' })} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary hover:bg-[var(--color-danger-hover)] hover:text-[var(--color-danger)]" aria-label="Remover capa"><Trash01 size={15} /></button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => coverInputRef.current?.click()} className="mt-3 flex aspect-[16/8] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-bg-primary text-sm text-ink-secondary hover:bg-bg-tertiary hover:text-ink-primary">
            <ImagePlus size={22} />
            {uploading ? 'Enviando…' : 'Adicionar capa'}
          </button>
        )}
        <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file) }} />
        {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}
        {draft.coverImageUrl ? (
          <div className="mt-3 space-y-3">
            <input className={fieldClass} value={draft.coverImageAlt} placeholder="Texto alternativo" onChange={(event) => onChange({ coverImageAlt: event.target.value })} />
            <input className={fieldClass} value={draft.coverImageCredit} placeholder="Crédito da imagem" onChange={(event) => onChange({ coverImageCredit: event.target.value })} />
          </div>
        ) : null}
      </section>

      <section className="editorial-inspector-section space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-ink-primary">Tópico principal</span>
          <EditorialTopicSelect value={draft.topic} onChange={(topic) => onChange({ topic })} />
        </div>
        <TagInput
          label="Tópicos relacionados"
          value={draft.topics}
          helper="Adicione vários termos livres, separados por vírgulas. Eles serão salvos como tópicos relacionados da lista."
          placeholder="Ex.: Marvel, X-Men, MCU"
          onChange={(topics) => onChange({ topics })}
        />
      </section>

      <section className="editorial-inspector-section space-y-5">
        <h2 className="text-sm font-semibold text-ink-primary">SEO</h2>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-primary">Título de busca</span>
          <input maxLength={180} className={fieldClass} value={draft.seoTitle} placeholder={draft.title || 'Título exibido no Google'} onChange={(event) => onChange({ seoTitle: event.target.value })} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-primary">Descrição</span>
          <textarea maxLength={320} rows={4} className={`${fieldClass} resize-none`} value={draft.seoDescription} placeholder="Resumo para mecanismos de busca" onChange={(event) => onChange({ seoDescription: event.target.value })} />
          <span className="mt-1.5 block text-right text-xs text-ink-muted">{draft.seoDescription.length}/320</span>
        </label>
        <TagInput label="Tags de SEO" value={draft.seoTags} helper="Termos usados para descrever o conteúdo." onChange={(seoTags) => onChange({ seoTags })} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-primary">Endereço</span>
          <div className="flex rounded-lg border border-border bg-[var(--input-bg)] focus-within:border-border-strong focus-within:shadow-[0_0_0_3px_var(--input-halo)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
            <span className="py-2.5 pl-3 text-sm text-ink-muted">/lists/</span>
            <input
              className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm text-ink-primary outline-none disabled:cursor-not-allowed"
              value={draft.slug}
              placeholder="slug-da-lista"
              disabled={slugLocked}
              aria-describedby="editorial-list-slug-helper"
              onChange={(event) => onChange({ slug: event.target.value })}
            />
          </div>
          <span id="editorial-list-slug-helper" className="mt-1.5 block text-xs leading-relaxed text-ink-muted">
            {slugLocked ? 'Endereço permanente desde a primeira publicação.' : 'O endereço será permanente depois da primeira publicação.'}
          </span>
        </label>
      </section>

      <section className="editorial-inspector-section">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-primary">Status</span>
          <select className={fieldClass} value={draft.status} onChange={(event) => onChange({ status: event.target.value as EditorialStatus })}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
      </section>
      </div>
    </aside>
    {scrollState.canScrollUp ? <div className="editorial-inspector-scroll-cue editorial-inspector-scroll-cue--top" aria-hidden="true" /> : null}
    {scrollState.canScrollDown ? <div className="editorial-inspector-scroll-cue editorial-inspector-scroll-cue--bottom" aria-hidden="true" /> : null}
    </div>
  )
}
