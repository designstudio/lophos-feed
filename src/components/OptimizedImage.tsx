'use client'

import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { imageFallbackCheckUrl } from '@/lib/image-url'

const TRANSPARENT_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

type ImageStage = 'optimized' | 'checking' | 'original' | 'placeholder'

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'onError'> & {
  originalSrc: string
  optimizedSrc: string
  optimizedSrcSet?: string
}

/**
 * Keeps optimized editorial images resilient without hiding proxy failures.
 * Direct fallback is attempted only after the server confirms that the
 * original target and every observed redirect are safe to request.
 */
export function OptimizedImage({
  originalSrc,
  optimizedSrc,
  optimizedSrcSet,
  alt,
  ...imageProps
}: OptimizedImageProps) {
  const [stage, setStage] = useState<ImageStage>('optimized')
  const imageRef = useRef<HTMLImageElement>(null)
  const attemptRef = useRef(0)
  const fallbackStartedRef = useRef(false)

  useEffect(() => {
    attemptRef.current += 1
    fallbackStartedRef.current = false
    setStage('optimized')
  }, [optimizedSrc, originalSrc])

  const handleError = async () => {
    if (stage === 'original') {
      setStage('placeholder')
      return
    }
    if (stage !== 'optimized') return
    if (fallbackStartedRef.current) return

    fallbackStartedRef.current = true
    const attempt = ++attemptRef.current
    setStage('checking')

    try {
      const response = await fetch(imageFallbackCheckUrl(originalSrc), {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (attempt !== attemptRef.current) return
      setStage(response.ok ? 'original' : 'placeholder')
    } catch {
      if (attempt === attemptRef.current) setStage('placeholder')
    }
  }

  useEffect(() => {
    const image = imageRef.current
    if (stage === 'optimized' && image?.complete && image.naturalWidth === 0) {
      void handleError()
    }
  }, [stage, optimizedSrc, originalSrc])

  const useOptimizedSource = stage === 'optimized'
  const useOriginalSource = stage === 'original'

  return (
    // Editorial sources are validated by the same SSRF policy before direct fallback.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imageRef}
      {...imageProps}
      src={useOptimizedSource ? optimizedSrc : useOriginalSource ? originalSrc : TRANSPARENT_PLACEHOLDER}
      srcSet={useOptimizedSource ? optimizedSrcSet : undefined}
      alt={stage === 'placeholder' ? '' : alt}
      onError={() => { void handleError() }}
      data-image-stage={stage}
    />
  )
}
