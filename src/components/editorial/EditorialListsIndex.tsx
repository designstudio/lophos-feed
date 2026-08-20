'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, Edit03, FilePlus01, Plus } from '@untitledui/icons'
import { SlidingTabs } from '@/components/SlidingTabs'
import type { EditorialListRecord, EditorialStatus } from './editorial-types'

const STATUS_LABELS: Record<EditorialStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
}

type EditorialListFilter = 'all' | EditorialStatus

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Arquivado' },
] as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function EditorialListsIndex() {
  const [lists, setLists] = useState<EditorialListRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<EditorialListFilter>('all')

  useEffect(() => {
    const controller = new AbortController()
    const query = filter === 'all' ? '' : `?status=${filter}`
    setLoading(true)
    setError('')
    fetch(`/api/admin/lists${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as listas.')
        return data.lists as EditorialListRecord[]
      })
      .then(setLists)
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as listas.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filter])

  return (
    <main className="route-scroll-container flex-1">
      <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12 md:px-10 md:pt-16">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-muted">Editorial</p>
            <h1 className="text-3xl font-semibold text-ink-primary">Listas</h1>
            <p className="mt-2 text-sm text-ink-secondary">Escreva, revise e publique conteúdos especiais do Lophos.</p>
          </div>
          <Link href="/admin/lists/new" className="editorial-primary-button"><Plus size={17} />Nova lista</Link>
        </div>

        <SlidingTabs
          value={filter}
          options={FILTER_OPTIONS}
          onChange={setFilter}
          ariaLabel="Filtrar listas por status"
          className="admin-list-filter-tabs mb-6"
        />

        {error ? <div className="rounded-xl border border-border bg-[var(--color-danger-hover)] p-4 text-sm text-[var(--color-danger)]">{error}</div> : null}
        {loading ? <div className="py-16 text-center text-sm text-ink-muted">Carregando listas…</div> : null}

        {!loading && !error && lists.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-ink-secondary"><FilePlus01 size={22} /></div>
            <h2 className="text-lg font-medium text-ink-primary">Nenhuma lista por aqui</h2>
            <p className="mt-2 max-w-sm text-sm text-ink-secondary">Crie o primeiro rascunho e escreva diretamente no editor.</p>
            <Link href="/admin/lists/new" className="editorial-secondary-button mt-6"><Plus size={17} />Criar lista</Link>
          </div>
        ) : null}

        {!loading && lists.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border">
            {lists.map((list, index) => (
              <Link key={list.id} href={`/admin/lists/${list.id}`} className={`group flex items-center gap-4 bg-bg-primary p-4 transition-colors hover:bg-bg-secondary md:p-5 ${index > 0 ? 'border-t border-border' : ''}`}>
                {list.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={list.cover_image_url} alt="" className="h-16 w-24 flex-none rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-24 flex-none items-center justify-center rounded-lg bg-bg-secondary text-ink-muted"><FilePlus01 size={20} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-bg-secondary px-2 py-1 text-[11px] font-medium text-ink-secondary group-hover:bg-bg-tertiary">{STATUS_LABELS[list.status]}</span>
                    <span className="text-xs capitalize text-ink-muted">{list.topic}</span>
                  </div>
                  <h2 className="truncate text-base font-medium text-ink-primary">{list.title}</h2>
                  <p className="mt-1 text-xs text-ink-muted">Editado em {formatDate(list.updated_at)} · {list.author_name}</p>
                </div>
                <span className="hidden h-9 w-9 flex-none items-center justify-center rounded-full text-ink-secondary group-hover:flex"><Edit03 size={17} /></span>
              </Link>
            ))}
          </div>
        ) : null}

        <p className="mt-5 flex items-center gap-2 text-xs text-ink-muted"><Archive size={14} />Excluir uma lista a arquiva sem apagar o conteúdo.</p>
      </div>
    </main>
  )
}
