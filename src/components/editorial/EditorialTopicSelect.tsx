'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, SearchMd } from '@untitledui/icons'
import { TopicIcon } from '@/components/TopicIcon'
import { cn } from '@/lib/utils'
import { DEFAULT_INTEREST_TOPICS, getInterestTopicLabel } from '@/lib/default-interest-topics'

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function EditorialTopicSelect({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value ? getInterestTopicLabel(value) : '')
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedLabel = value ? getInterestTopicLabel(value) : ''
  const normalizedQuery = normalizeSearch(query.trim())
  const filteredTopics = DEFAULT_INTEREST_TOPICS.filter((topic) => (
    !normalizedQuery
    || normalizeSearch(topic).includes(normalizedQuery)
    || (selectedLabel === query && topic !== selectedLabel)
  ))

  useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectTopic = (topic: string) => {
    onChange(topic)
    setQuery(topic)
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-[var(--input-bg)] px-3 text-sm transition-shadow focus-within:border-border-strong focus-within:shadow-[0_0_0_3px_var(--input-halo)]">
        {selectedLabel && query === selectedLabel ? <TopicIcon topic={selectedLabel} size={15} className="flex-none text-ink-secondary" /> : <SearchMd size={15} className="flex-none text-ink-muted" />}
        <input
          value={query}
          role="combobox"
          aria-label="Buscar tópico principal"
          aria-autocomplete="list"
          aria-controls="editorial-main-topic-options"
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `editorial-main-topic-${activeIndex}` : undefined}
          placeholder="Buscar tópico"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-ink-primary outline-none placeholder:text-ink-muted"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
            if (!event.target.value) onChange('')
          }}
          onBlur={() => {
            setOpen(false)
            setQuery(selectedLabel)
            setActiveIndex(-1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && filteredTopics.length > 0) {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => (current + 1) % filteredTopics.length)
            } else if (event.key === 'ArrowUp' && filteredTopics.length > 0) {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => current <= 0 ? filteredTopics.length - 1 : current - 1)
            } else if (event.key === 'Enter' && open && filteredTopics.length > 0) {
              event.preventDefault()
              selectTopic(filteredTopics[activeIndex >= 0 ? activeIndex : 0])
            } else if (event.key === 'Escape') {
              setOpen(false)
              setQuery(selectedLabel)
            }
          }}
        />
      </div>

      {open ? (
        <div id="editorial-main-topic-options" className="absolute right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-[var(--color-bg-elevated)] p-1.5 shadow-[0_1px_2px_#0000000d]" role="listbox" aria-label="Tópicos principais">
          {filteredTopics.map((topic, index) => {
            const selected = getInterestTopicLabel(value) === topic
            return (
              <button
                key={topic}
                id={`editorial-main-topic-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectTopic(topic)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-hover-elevated)]',
                  selected || index === activeIndex ? 'bg-[var(--color-hover-elevated)] font-medium text-ink-primary' : 'text-ink-secondary',
                )}
              >
                <TopicIcon topic={topic} size={14} className="flex-none" />
                <span className="min-w-0 flex-1 truncate">{topic}</span>
                {selected ? <Check size={15} className="flex-none" /> : null}
              </button>
            )
          })}
          {filteredTopics.length === 0 ? <p className="px-3 py-3 text-sm text-ink-muted">Nenhum tópico encontrado.</p> : null}
        </div>
      ) : null}
    </div>
  )
}
