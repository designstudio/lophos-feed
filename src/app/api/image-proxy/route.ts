import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { IMAGE_PROXY_QUALITIES, IMAGE_PROXY_WIDTHS } from '@/lib/image-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 15

const MAX_REDIRECTS = 3
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_INPUT_PIXELS = 40_000_000
const MEMORY_CACHE_BYTES = 48 * 1024 * 1024
const CACHE_CONTROL = 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800'

type OutputFormat = 'avif' | 'webp' | 'jpeg' | 'png' | 'original'
type CachedVariant = { body: ArrayBuffer; headers: Record<string, string>; size: number }

const variantCache = new Map<string, CachedVariant>()
let variantCacheBytes = 0

class ImageProxyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function parseAllowedNumber(value: string | null, allowed: readonly number[], fallback: number) {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || !allowed.includes(parsed)) {
    throw new ImageProxyError('Unsupported image parameter', 400)
  }
  return parsed
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address)
  if (isIP(address) !== 6) return true
  const normalized = address.toLowerCase().split('%')[0]
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4)
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
}

async function assertPublicTarget(target: URL) {
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new ImageProxyError('Unsupported image URL', 400)
  }
  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new ImageProxyError('Blocked image host', 403)
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new ImageProxyError('Blocked image host', 403)
    return
  }
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new ImageProxyError('Image host could not be resolved', 502)
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ImageProxyError('Blocked image host', 403)
  }
}

async function fetchUpstream(initialTarget: URL) {
  let target = initialTarget
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicTarget(target)
    let response: Response
    try {
      response = await fetch(target, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LophosImageOptimizer/1.0)',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: target.origin,
        },
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      console.error('[image-proxy] upstream fetch failed', { host: target.hostname, reason: error instanceof Error ? error.name : 'unknown' })
      throw new ImageProxyError('Proxy fetch failed', 502)
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirect === MAX_REDIRECTS) throw new ImageProxyError('Unsafe or excessive image redirect', 502)
      target = new URL(location, target)
      continue
    }
    if (!response.ok) throw new ImageProxyError(`Upstream image error: ${response.status}`, 502)
    return response
  }
  throw new ImageProxyError('Excessive image redirects', 502)
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > MAX_SOURCE_BYTES) throw new ImageProxyError('Source image is too large', 413)
  if (!response.body) throw new ImageProxyError('Source image is empty', 502)
  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel()
      throw new ImageProxyError('Source image is too large', 413)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
}

function chooseFormat(accept: string, sourceType: string): OutputFormat {
  if (sourceType.includes('svg') || sourceType.includes('gif')) return 'original'
  if (accept.includes('image/avif')) return 'avif'
  if (accept.includes('image/webp')) return 'webp'
  if (sourceType.includes('png')) return 'png'
  return 'jpeg'
}

function outputContentType(format: OutputFormat, sourceType: string) {
  return format === 'original' ? sourceType : `image/${format}`
}

function cacheKey(source: string, width: number, quality: number, format: OutputFormat) {
  return createHash('sha256').update(`${source}\0${width}\0${quality}\0${format}`).digest('hex')
}

function readMemoryCache(key: string) {
  const cached = variantCache.get(key)
  if (!cached) return null
  variantCache.delete(key)
  variantCache.set(key, cached)
  return cached
}

function writeMemoryCache(key: string, value: CachedVariant) {
  if (value.size > MEMORY_CACHE_BYTES / 3) return
  while (variantCacheBytes + value.size > MEMORY_CACHE_BYTES && variantCache.size > 0) {
    const oldestKey = variantCache.keys().next().value as string
    const oldest = variantCache.get(oldestKey)
    variantCache.delete(oldestKey)
    variantCacheBytes -= oldest?.size ?? 0
  }
  variantCache.set(key, value)
  variantCacheBytes += value.size
}

function imageResponse(request: NextRequest, variant: CachedVariant, cacheStatus: 'HIT' | 'MISS') {
  if (request.headers.get('if-none-match') === variant.headers.ETag) {
    return new Response(null, { status: 304, headers: { ...variant.headers, 'X-Image-Cache': cacheStatus } })
  }
  return new Response(variant.body, { headers: { ...variant.headers, 'X-Image-Cache': cacheStatus } })
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('url')
  if (!source || source.length > 4096) return new Response('Invalid image URL', { status: 400 })

  try {
    const target = new URL(source)
    const width = parseAllowedNumber(request.nextUrl.searchParams.get('w'), IMAGE_PROXY_WIDTHS, 1200)
    const quality = parseAllowedNumber(request.nextUrl.searchParams.get('q'), IMAGE_PROXY_QUALITIES, 75)
    const accept = request.headers.get('accept') || ''
    const requestedFormat: OutputFormat = accept.includes('image/avif') ? 'avif' : accept.includes('image/webp') ? 'webp' : 'jpeg'
    const provisionalKey = cacheKey(source, width, quality, requestedFormat)
    const cached = readMemoryCache(provisionalKey)
    if (cached) return imageResponse(request, cached, 'HIT')

    const upstream = await fetchUpstream(target)
    const sourceType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!sourceType.startsWith('image/')) throw new ImageProxyError('Upstream response is not an image', 415)
    const format = chooseFormat(accept, sourceType)
    let responseFormat = format

    const original = await readLimitedBody(upstream)
    let output: Buffer
    let originalWidth: number | undefined
    let originalHeight: number | undefined
    let deliveredWidth: number | undefined
    let deliveredHeight: number | undefined
    if (format === 'original') {
      output = original
    } else {
      let pipeline = sharp(original, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true })
      const metadata = await pipeline.metadata()
      originalWidth = metadata.width
      originalHeight = metadata.height
      pipeline = pipeline.rotate().resize({ width, withoutEnlargement: true, fit: 'inside' })
      if (format === 'avif') pipeline = pipeline.avif({ quality: Math.max(45, quality - 15), effort: 4 })
      else if (format === 'webp') pipeline = pipeline.webp({ quality, effort: 4 })
      else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, quality })
      else pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true })
      const transformed = await pipeline.toBuffer({ resolveWithObject: true })
      if (transformed.data.byteLength >= original.byteLength) {
        output = original
        responseFormat = 'original'
        deliveredWidth = originalWidth
        deliveredHeight = originalHeight
      } else {
        output = transformed.data
        deliveredWidth = transformed.info.width
        deliveredHeight = transformed.info.height
      }
    }

    const body = Uint8Array.from(output).buffer
    const etag = `"${createHash('sha256').update(output).digest('hex').slice(0, 24)}"`
    const headers: Record<string, string> = {
      'Cache-Control': CACHE_CONTROL,
      'Content-Length': String(body.byteLength),
      'Content-Type': outputContentType(responseFormat, sourceType),
      ETag: etag,
      Vary: 'Accept',
      'X-Content-Type-Options': 'nosniff',
      ...(originalWidth ? { 'X-Image-Original-Width': String(originalWidth) } : {}),
      ...(originalHeight ? { 'X-Image-Original-Height': String(originalHeight) } : {}),
      ...(deliveredWidth ? { 'X-Image-Width': String(deliveredWidth) } : {}),
      ...(deliveredHeight ? { 'X-Image-Height': String(deliveredHeight) } : {}),
    }
    const variant = { body, headers, size: body.byteLength }
    // The requested-format key is already scoped by source, width, quality and
    // Accept capability. It may point to an original GIF/SVG or PNG fallback.
    writeMemoryCache(provisionalKey, variant)
    return imageResponse(request, variant, 'MISS')
  } catch (error) {
    const status = error instanceof ImageProxyError ? error.status : 422
    const message = error instanceof ImageProxyError ? error.message : 'Image decode failed'
    if (!(error instanceof ImageProxyError)) {
      console.error('[image-proxy] image processing failed', { reason: error instanceof Error ? error.name : 'unknown' })
    }
    return new Response(message, { status })
  }
}
