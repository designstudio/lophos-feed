'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X as CloseCircle } from '@untitledui/icons'
import { useModalTransition } from '@/hooks/useModalTransition'
import { cn } from '@/lib/utils'
import { imageProxySrcSet, imageProxyUrl } from '@/lib/image-url'
import { OptimizedImage } from '@/components/OptimizedImage'

const EDITORIAL_IMAGE_WIDTHS = [480, 640, 768, 960, 1200, 1600] as const

export function ZoomableEditorialImage({ src, alt, credit, priority = false }: {
  src: string
  alt: string
  credit?: string
  priority?: boolean
}) {
  const [open, setOpen] = useState(false)
  const transition = useModalTransition(open)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!transition.rendered) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [transition.rendered])

  useEffect(() => {
    if (!transition.open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [transition.open])

  useEffect(() => {
    if (!transition.rendered && !open) triggerRef.current?.focus({ preventScroll: true })
  }, [open, transition.rendered])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in"
        aria-label="Ampliar imagem"
      >
        <span className="block aspect-[16/10] w-full overflow-hidden rounded-[1.5rem] bg-bg-secondary shadow-md transition-transform duration-150 group-hover:scale-[1.02] group-hover:shadow-lg">
          <OptimizedImage
            originalSrc={src}
            optimizedSrc={imageProxyUrl(src, 1200, 80)}
            optimizedSrcSet={imageProxySrcSet(src, EDITORIAL_IMAGE_WIDTHS, 80)}
            sizes="(max-width: 767px) calc(100vw - 2rem), 768px"
            alt={alt}
            className="h-full w-full object-cover"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        </span>
        {credit ? (
          <span
            className="pointer-events-none absolute bottom-2 left-2 w-auto rounded-md px-2 py-1.5 text-[11px] font-medium text-white/80"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            {credit}
          </span>
        ) : null}
      </button>

      {transition.rendered ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: '#05050533', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className={cn(
              't-modal absolute inset-0 flex items-center justify-center p-4',
              transition.open && 'is-open',
              transition.closing && 'is-closing',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Visualização ampliada da imagem"
            aria-hidden={!transition.open}
            inert={!transition.open}
            onClick={() => setOpen(false)}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
              }}
              className="absolute right-4 top-4 text-white transition-colors hover:text-gray-300"
              aria-label="Fechar imagem"
            >
              <CloseCircle size={24} />
            </button>
            <OptimizedImage
              originalSrc={src}
              optimizedSrc={imageProxyUrl(src, 1600, 80)}
              alt={alt}
              className="max-h-[90vh] max-w-full rounded-[1.5rem] object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
