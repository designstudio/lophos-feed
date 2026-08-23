export const IMAGE_PROXY_WIDTHS = [64, 96, 160, 320, 480, 640, 768, 960, 1200, 1600] as const
export const IMAGE_PROXY_QUALITIES = [65, 70, 75, 80, 85] as const

type ImageProxyWidth = (typeof IMAGE_PROXY_WIDTHS)[number]
type ImageProxyQuality = (typeof IMAGE_PROXY_QUALITIES)[number]

export function imageProxyUrl(
  source: string,
  width: ImageProxyWidth,
  quality: ImageProxyQuality = 75,
) {
  const params = new URLSearchParams({ url: source, w: String(width), q: String(quality) })
  return `/api/image-proxy?${params}`
}

export function imageProxySrcSet(
  source: string,
  widths: readonly ImageProxyWidth[],
  quality: ImageProxyQuality = 75,
) {
  return widths.map((width) => `${imageProxyUrl(source, width, quality)} ${width}w`).join(', ')
}

export function clerkImageUrl(source: string, size: number) {
  try {
    const url = new URL(source)
    if (!url.hostname.endsWith('clerk.com') && !url.hostname.endsWith('clerk.dev')) return source
    url.searchParams.set('width', String(size))
    url.searchParams.set('height', String(size))
    url.searchParams.set('quality', '85')
    url.searchParams.set('fit', 'crop')
    return url.toString()
  } catch {
    return source
  }
}

export function isUsableEditorialImage(source?: string) {
  if (!source) return false
  const normalized = source.toLowerCase()
  return !['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif']
    .some((pattern) => normalized.includes(pattern))
}
