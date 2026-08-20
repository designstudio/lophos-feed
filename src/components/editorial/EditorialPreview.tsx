'use client'

import { useEffect } from 'react'
import { Clock, XClose } from '@untitledui/icons'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EditorialDocumentView } from './EditorialDocument'
import type { EditorialDraft } from './editorial-types'
import { ZoomableEditorialImage } from './ZoomableEditorialImage'
import { TopicIcon } from '@/components/TopicIcon'

export function EditorialPreview({ draft, authorName, authorImageUrl, publishedAt, onClose }: {
  draft: EditorialDraft
  authorName: string
  authorImageUrl: string | null
  publishedAt?: string | null
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const publicationLabel = publishedAt
    ? formatDistanceToNow(new Date(publishedAt), { addSuffix: true, locale: ptBR })
    : 'agora'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg-primary" role="dialog" aria-modal="true" aria-label="Preview da lista">
      <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-bg-primary px-5 md:px-8">
        <div>
          <p className="text-sm font-medium text-ink-primary">Preview</p>
          <p className="text-xs text-ink-muted">Assim a lista aparece para o leitor</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary hover:bg-bg-secondary hover:text-ink-primary" aria-label="Fechar preview">
          <XClose size={20} />
        </button>
      </div>

      <main className="article-layout mx-auto px-6 pb-24 pt-[10vh]">
        <span className="category-topic-pill">
          <TopicIcon topic={draft.topic} />
          <span>{draft.topic ? draft.topic.charAt(0).toLocaleUpperCase('pt-BR') + draft.topic.slice(1) : 'Tópico'}</span>
        </span>
        <h1 className="mb-3 mt-2 break-words text-4xl leading-tight text-ink-primary">{draft.title || 'Título da lista'}</h1>

        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Clock size={16} />
          <span>Publicado {publicationLabel}</span>
          <span aria-hidden="true">·</span>
          {authorImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authorImageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
          ) : <span className="h-5 w-5 rounded-full bg-bg-tertiary" />}
          <span>Por {authorName}</span>
        </div>

        {draft.coverImageUrl ? (
          <figure className="mb-8">
            <ZoomableEditorialImage src={draft.coverImageUrl} alt={draft.coverImageAlt} credit={draft.coverImageCredit} imageClassName="article-image h-auto w-full" />
          </figure>
        ) : null}

        <EditorialDocumentView document={draft.contentJson} />
      </main>
    </div>
  )
}
