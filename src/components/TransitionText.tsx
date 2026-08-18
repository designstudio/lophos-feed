'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type TransitionTextProps = {
  children: ReactNode
  stateKey: string
}

export function TransitionText({ children, stateKey }: TransitionTextProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const latestContentRef = useRef(children)
  const previousKeyRef = useRef(stateKey)
  const [renderedContent, setRenderedContent] = useState(children)

  latestContentRef.current = children

  useEffect(() => {
    if (previousKeyRef.current === stateKey) return
    previousKeyRef.current = stateKey

    const element = elementRef.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRenderedContent(latestContentRef.current)
      return
    }

    const duration = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur'),
    ) || 150

    element.classList.remove('is-enter-start')
    element.classList.add('is-exit')

    let frame = 0
    const timeout = window.setTimeout(() => {
      setRenderedContent(latestContentRef.current)
      frame = window.requestAnimationFrame(() => {
        element.classList.remove('is-exit')
        element.classList.add('is-enter-start')
        void element.offsetHeight
        element.classList.remove('is-enter-start')
      })
    }, duration)

    return () => {
      window.clearTimeout(timeout)
      window.cancelAnimationFrame(frame)
      element.classList.remove('is-exit', 'is-enter-start')
    }
  }, [stateKey])

  return <span ref={elementRef} className="t-text-swap">{renderedContent}</span>
}
