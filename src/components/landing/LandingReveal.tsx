'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type LandingRevealProps = {
  children: ReactNode
  className?: string
}

export function LandingReveal({ children, className }: LandingRevealProps) {
  const blockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const block = blockRef.current
    if (!block) return

    const showText = () => {
      block.classList.remove('is-hiding')
      block.classList.remove('is-shown')
      void block.offsetHeight
      block.classList.add('is-shown')
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        showText()
        observer.disconnect()
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 },
    )

    observer.observe(block)
    return () => observer.disconnect()
  }, [])

  return <div ref={blockRef} className={cn('t-stagger', className)}>{children}</div>
}
