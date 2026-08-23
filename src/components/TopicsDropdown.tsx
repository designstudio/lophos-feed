'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useDropdownTransition } from '@/hooks/useDropdownTransition'

export function TopicsDropdown({ topics, activeFilter, onSelect }: {
  topics: string[]
  activeFilter: string | null
  onSelect: (topic: string | null) => void
}) {
  const { open, closing, closeDropdown, toggleDropdown } = useDropdownTransition()
  const [scrollState, setScrollState] = useState({ canScrollUp: false, canScrollDown: false })
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const updateScrollState = useCallback(() => {
    const list = listRef.current
    if (!list) return

    const overflowing = list.scrollHeight > list.clientHeight + 1
    setScrollState({
      canScrollUp: overflowing && list.scrollTop > 1,
      canScrollDown: overflowing && list.scrollTop + list.clientHeight < list.scrollHeight - 1,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) closeDropdown()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [closeDropdown, open])

  useEffect(() => {
    if (!open) return
    const list = listRef.current
    if (!list) return

    const frame = requestAnimationFrame(updateScrollState)
    list.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      cancelAnimationFrame(frame)
      list.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [activeFilter, open, topics.length, updateScrollState])

  const scrollTopics = (direction: -1 | 1) => {
    listRef.current?.scrollBy({ top: direction * 160, behavior: 'smooth' })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleDropdown}
        aria-expanded={open}
        className={cn(
          'editorial-filter flex items-center gap-1.5 transition-colors',
          activeFilter ? 'is-active' : 'text-ink-tertiary hover:text-ink-primary',
        )}
      >
        {activeFilter ?? 'Tópicos'}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={cn('transition-transform flex-shrink-0', open && 'rotate-180')}
          aria-hidden="true"
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={cn(
          't-dropdown absolute top-full left-0 mt-1 flex w-56 flex-col overflow-hidden rounded-xl border border-border bg-[var(--color-bg-elevated)] py-1 shadow-[0_4px_12px_#0000000d] z-50',
          open && 'is-open',
          closing && 'is-closing',
        )}
        data-origin="top-left"
        aria-hidden={!open}
        inert={!open}
      >
          {scrollState.canScrollUp && (
            <div className="topics-dropdown__scroll-cue topics-dropdown__scroll-cue--top">
              <button
                type="button"
                className="topics-dropdown__scroll-button"
                onClick={() => scrollTopics(-1)}
                aria-label="Rolar tópicos para cima"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3.5 8.5 7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          <div ref={listRef} className="topics-dropdown__list max-h-72 overflow-y-auto px-1.5">
            {activeFilter && (
              <button
                type="button"
                onClick={() => { onSelect(null); closeDropdown() }}
                className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-ink-tertiary transition-colors hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Ver todos
              </button>
            )}
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => { onSelect(topic); closeDropdown() }}
                className={cn(
                  'flex w-full items-center rounded-lg px-4 py-2.5 text-left text-sm transition-colors',
                  activeFilter === topic
                    ? 'bg-[var(--color-hover-elevated)] font-medium text-ink-primary'
                    : 'text-ink-secondary hover:bg-[var(--color-hover-elevated)] hover:text-ink-primary',
                )}
              >
                {topic}
              </button>
            ))}
          </div>

          {scrollState.canScrollDown && (
            <div className="topics-dropdown__scroll-cue topics-dropdown__scroll-cue--bottom">
              <button
                type="button"
                className="topics-dropdown__scroll-button"
                onClick={() => scrollTopics(1)}
                aria-label="Rolar tópicos para baixo"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="m3.5 5.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

      </div>
    </div>
  )
}
