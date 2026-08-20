'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export type SlidingTabOption<T extends string> = {
  value: T
  label: string
}

export function SlidingTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T
  options: readonly SlidingTabOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  const pillRef = useRef<HTMLSpanElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<T, HTMLButtonElement>())
  const mountedRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const positionPill = useCallback((selected: T, animate: boolean) => {
    const pill = pillRef.current
    const tab = tabRefs.current.get(selected)
    if (!pill || !tab) return

    if (!animate) pill.style.transition = 'none'
    pill.style.transform = `translateX(${tab.offsetLeft}px)`
    pill.style.width = `${tab.offsetWidth}px`

    if (!animate) {
      void pill.offsetWidth
      pill.style.removeProperty('transition')
    }
  }, [])

  useLayoutEffect(() => {
    positionPill(value, mountedRef.current)
    mountedRef.current = true
  }, [positionPill, value])

  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return
    const reposition = () => positionPill(valueRef.current, false)
    const observer = new ResizeObserver(reposition)
    observer.observe(tabs)
    window.addEventListener('resize', reposition)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reposition)
    }
  }, [positionPill])

  const selectRelative = (currentIndex: number, direction: -1 | 1) => {
    const nextIndex = (currentIndex + direction + options.length) % options.length
    const next = options[nextIndex]
    onChange(next.value)
    window.requestAnimationFrame(() => tabRefs.current.get(next.value)?.focus())
  }

  return (
    <div ref={tabsRef} className={cn('feed-view-switcher t-tabs', className)} role="tablist" aria-label={ariaLabel}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => {
              if (element) tabRefs.current.set(option.value, element)
              else tabRefs.current.delete(option.value)
            }}
            type="button"
            className="t-tab"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault()
                selectRelative(index, -1)
              } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                selectRelative(index, 1)
              } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault()
                const next = event.key === 'Home' ? options[0] : options[options.length - 1]
                onChange(next.value)
                window.requestAnimationFrame(() => tabRefs.current.get(next.value)?.focus())
              }
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
