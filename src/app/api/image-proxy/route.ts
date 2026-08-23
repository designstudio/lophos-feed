import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { performance } from 'node:perf_hooks'
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
const ERROR_CACHE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
}

type OutputFormat = 'avif' | 'webp' | 'jpeg' | 'png' | 'original'
type CachedVariant = { body: ArrayBuffer; headers: Record<string, string>; size: number }
type TimingName = 'cache_lookup' | 'dns' | 'upstream' | 'redirects' | 'download'
  | 'sharp_decode' | 'resize' | 'encode' | 'cache_write'

class ProxyTimings {
  private readonly startedAt = performance.now()
  private readonly durations = new Map<TimingName, number>()
  redirectCount = 0

  add(name: TimingName, duration: number) {
    this.durations.set(name, (this.durations.get(name) ?? 0) + duration)
  }

  measure(name: TimingName, startedAt: number) {
    this.add(name, performance.now() - startedAt)
  }

  header(cache: 'NODE_HIT' | 'NODE_MISS' | 'BYPASS') {
    const ordered: TimingName[] = [
      'cache_lookup', 'dns', 'upstream', 'redirects', 'download',
      'sharp_decode', 'resize', 'encode', 'cache_write',
    ]
    const metrics = [`cache;desc="${cache}"`]
    for (const name of ordered) {
      const duration = this.durations.get(name)
      if (duration === undefined) continue
      const description = name === 'dns' ? ';desc="ssrf_lookup"'
        : name === 'upstream' ? ';desc="to_headers"'
          : name === 'redirects' ? `;desc="count:${this.redirectCount}"`
            : name === 'sharp_decode' ? ';desc="metadata_probe"'
              : name === 'resize' ? ';desc="pipeline_setup"'
                : name === 'encode' ? ';desc="sharp_pipeline"'
                  : ''
      metrics.push(`${name};dur=${duration.toFixed(1)}${description}`)
    }
    metrics.push(`total;dur=${(performance.now() - this.startedAt).toFixed(1)}`)
    return metrics.join(', ')
  }
}

const variantCache = new Map<string, CachedVariant>()
let variantCacheBytes = 0

class ImageProxyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly directFallbackAllowed = false,
  ) {
    super(message)
  }
}

function upstreamHeaders() {
  return {
    'User-Agent': 'LophosImageOptimizer/1.0',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  }
}

function sanitizedFetchReason(error: unknown) {
  if (!(error instanceof Error)) return 'unknown'
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout'
  return error.name
}

function upstreamAllowsDirectFallback(status: number) {
  return status === 401 || status === 403 || status === 429 || status >= 500
}

function errorResponse(
  message: string,
  status: number,
  directFallbackAllowed = false,
  timings = new ProxyTimings(),
  cache: 'NODE_HIT' | 'NODE_MISS' | 'BYPASS' = 'BYPASS',
) {
  return new Response(message, {
    status,
    headers: {
      ...ERROR_CACHE_HEADERS,
      'X-Image-Direct-Fallback': directFallbackAllowed ? 'allowed' : 'denied',
      'Server-Timing': timings.header(cache),
    },
  })
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

async function assertPublicTarget(target: URL, timings?: ProxyTimings) {
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
  const dnsStartedAt = performance.now()
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    timings?.measure('dns', dnsStartedAt)
    throw new ImageProxyError('Image host could not be resolved', 502)
  }
  timings?.measure('dns', dnsStartedAt)
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ImageProxyError('Blocked image host', 403)
  }
}

async function fetchUpstream(initialTarget: URL, timings: ProxyTimings) {
  let target = initialTarget
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicTarget(target, timings)
    let response: Response
    const upstreamStartedAt = performance.now()
    try {
      response = await fetch(target, {
        redirect: 'manual',
        headers: upstreamHeaders(),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      timings.measure('upstream', upstreamStartedAt)
      console.warn('image_proxy_fetch_failed', { host: target.hostname, reason: sanitizedFetchReason(error) })
      throw new ImageProxyError('Proxy fetch failed', 502, true)
    }
    timings.measure('upstream', upstreamStartedAt)
    if (response.status >= 300 && response.status < 400) {
      const redirectStartedAt = performance.now()
      const location = response.headers.get('location')
      if (!location || redirect === MAX_REDIRECTS) throw new ImageProxyError('Unsafe or excessive image redirect', 502)
      target = new URL(location, target)
      timings.redirectCount += 1
      timings.measure('redirects', redirectStartedAt)
      continue
    }
    if (!response.ok) {
      const directFallbackAllowed = upstreamAllowsDirectFallback(response.status)
      if (directFallbackAllowed) {
        console.warn('image_proxy_upstream_rejected', { host: target.hostname, status: response.status })
      }
      throw new ImageProxyError(`Upstream image error: ${response.status}`, 502, directFallbackAllowed)
    }
    return response
  }
  throw new ImageProxyError('Excessive image redirects', 502)
}

async function canUseDirectFallback(initialTarget: URL, timings?: ProxyTimings) {
  let target = initialTarget

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicTarget(target, timings)

    let response: Response
    const upstreamStartedAt = performance.now()
    try {
      response = await fetch(target, {
        redirect: 'manual',
        headers: upstreamHeaders(),
        signal: AbortSignal.timeout(5_000),
      })
    } catch {
      timings?.measure('upstream', upstreamStartedAt)
      // The target was public when resolved. A connection error or timeout is
      // exactly when a browser-side request may still succeed.
      return true
    }
    timings?.measure('upstream', upstreamStartedAt)

    if (response.status >= 300 && response.status < 400) {
      const redirectStartedAt = performance.now()
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location || redirect === MAX_REDIRECTS) return false
      target = new URL(location, target)
      if (timings) {
        timings.redirectCount += 1
        timings.measure('redirects', redirectStartedAt)
      }
      continue
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    const allowed = upstreamAllowsDirectFallback(response.status)
      || (response.ok && contentType.startsWith('image/'))
    await response.body?.cancel()
    return allowed
  }

  return false
}

async function readLimitedBody(response: Response, timings: ProxyTimings) {
  const downloadStartedAt = performance.now()
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
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
  timings.measure('download', downloadStartedAt)
  return body
}

function chooseFormat(accept: string, sourceType: string): OutputFormat {
  if (sourceType.includes('svg') || sourceType.includes('gif')) return 'original'
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

function imageResponse(
  request: NextRequest,
  variant: CachedVariant,
  cacheStatus: 'HIT' | 'MISS',
  timings: ProxyTimings,
) {
  const headers = {
    ...variant.headers,
    'X-Image-Cache': cacheStatus,
    'Server-Timing': timings.header(cacheStatus === 'HIT' ? 'NODE_HIT' : 'NODE_MISS'),
  }
  if (request.headers.get('if-none-match') === variant.headers.ETag) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(variant.body, { headers })
}

export async function GET(request: NextRequest) {
  const timings = new ProxyTimings()
  let cacheState: 'NODE_MISS' | 'BYPASS' = 'BYPASS'
  const source = request.nextUrl.searchParams.get('url')
  if (!source || source.length > 4096) return errorResponse('Invalid image URL', 400, false, timings)

  try {
    const target = new URL(source)
    const width = parseAllowedNumber(request.nextUrl.searchParams.get('w'), IMAGE_PROXY_WIDTHS, 1200)
    const quality = parseAllowedNumber(request.nextUrl.searchParams.get('q'), IMAGE_PROXY_QUALITIES, 75)
    const accept = request.headers.get('accept') || ''
    const requestedFormat: OutputFormat = accept.includes('image/webp') ? 'webp' : 'jpeg'
    const provisionalKey = cacheKey(source, width, quality, requestedFormat)
    const cacheLookupStartedAt = performance.now()
    const cached = readMemoryCache(provisionalKey)
    timings.measure('cache_lookup', cacheLookupStartedAt)
    if (cached) return imageResponse(request, cached, 'HIT', timings)
    cacheState = 'NODE_MISS'
    timings.add('redirects', 0)

    const upstream = await fetchUpstream(target, timings)
    const sourceType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!sourceType.startsWith('image/')) throw new ImageProxyError('Upstream response is not an image', 415)
    const format = chooseFormat(accept, sourceType)
    let responseFormat = format

    const original = await readLimitedBody(upstream, timings)
    let output: Buffer
    let originalWidth: number | undefined
    let originalHeight: number | undefined
    let deliveredWidth: number | undefined
    let deliveredHeight: number | undefined
    if (format === 'original') {
      output = original
    } else {
      const decodeStartedAt = performance.now()
      let pipeline = sharp(original, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true })
      const metadata = await pipeline.metadata()
      timings.measure('sharp_decode', decodeStartedAt)
      originalWidth = metadata.width
      originalHeight = metadata.height
      const resizeStartedAt = performance.now()
      pipeline = pipeline.rotate().resize({ width, withoutEnlargement: true, fit: 'inside' })
      timings.measure('resize', resizeStartedAt)
      const encodeStartedAt = performance.now()
      if (format === 'avif') pipeline = pipeline.avif({ quality: Math.max(45, quality - 15), effort: 4 })
      else if (format === 'webp') pipeline = pipeline.webp({ quality, effort: 4 })
      else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, quality })
      else pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true })
      const transformed = await pipeline.toBuffer({ resolveWithObject: true })
      timings.measure('encode', encodeStartedAt)
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
    const cacheWriteStartedAt = performance.now()
    writeMemoryCache(provisionalKey, variant)
    timings.measure('cache_write', cacheWriteStartedAt)
    return imageResponse(request, variant, 'MISS', timings)
  } catch (error) {
    const status = error instanceof ImageProxyError ? error.status : 422
    const message = error instanceof ImageProxyError ? error.message : 'Image decode failed'
    if (!(error instanceof ImageProxyError)) {
      let host = 'invalid'
      try { host = new URL(source).hostname } catch {}
      console.warn('image_proxy_transform_failed', { host, reason: sanitizedFetchReason(error) })
    }
    return errorResponse(
      message,
      status,
      error instanceof ImageProxyError ? error.directFallbackAllowed : true,
      timings,
      cacheState,
    )
  }
}

export async function HEAD(request: NextRequest) {
  const timings = new ProxyTimings()
  if (request.nextUrl.searchParams.get('fallback') !== 'check') {
    return errorResponse('Unsupported image proxy request', 405, false, timings)
  }

  const source = request.nextUrl.searchParams.get('url')
  if (!source || source.length > 4096) return errorResponse('Invalid image URL', 400, false, timings)

  try {
    const target = new URL(source)
    timings.add('redirects', 0)
    const allowed = await canUseDirectFallback(target, timings)
    return new Response(null, {
      status: allowed ? 204 : 403,
      headers: {
        ...ERROR_CACHE_HEADERS,
        'X-Image-Direct-Fallback': allowed ? 'allowed' : 'denied',
        'Server-Timing': timings.header('BYPASS'),
      },
    })
  } catch {
    return errorResponse('Direct image fallback denied', 403, false, timings)
  }
}
