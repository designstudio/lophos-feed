import { getSupabaseAdmin } from '@/lib/supabase'
import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import path from 'path'
import { createDedupHash, extractText, stripHtml } from '@/lib/news-preprocessing'
import { inferRssTopic } from '@/lib/topic-classifier'

const LOG_DIR = path.resolve(process.cwd(), 'logs')
const INGEST_LOCK_FILE = path.join(LOG_DIR, 'rss-ingest.lock')
const INGEST_LOCK_STALE_MS = Number(process.env.RSS_INGEST_LOCK_STALE_MS || 2 * 60 * 60 * 1000)

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function readLockState() {
  try {
    return JSON.parse(fs.readFileSync(INGEST_LOCK_FILE, 'utf8'))
  } catch {
    return null
  }
}

function lockLooksStale(lockState: { startedAt?: string } | null) {
  if (!lockState?.startedAt) return true
  const startedAtMs = Date.parse(lockState.startedAt)
  if (!Number.isFinite(startedAtMs)) return true
  return Date.now() - startedAtMs > INGEST_LOCK_STALE_MS
}

function acquireIngestLock() {
  ensureLogDir()

  try {
    const fd = fs.openSync(INGEST_LOCK_FILE, 'wx')
    fs.writeFileSync(fd, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      source: 'next-route',
    }, null, 2))
    return { acquired: true as const, fd }
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      const lockState = readLockState()
      if (lockLooksStale(lockState)) {
        console.warn(`[rss/ingest] Found stale lock from pid=${(lockState as any)?.pid ?? 'unknown'} startedAt=${lockState?.startedAt ?? 'unknown'}. Removing it.`)
        fs.unlinkSync(INGEST_LOCK_FILE)
        return acquireIngestLock()
      }

      console.log('[rss/ingest] Another ingest run is already active. Skipping.')
      return { acquired: false as const, reason: 'lock-active' as const, lockState }
    }

    throw err
  }
}

function releaseIngestLock(fd: number) {
  try {
    fs.closeSync(fd)
  } catch {}

  try {
    fs.unlinkSync(INGEST_LOCK_FILE)
  } catch {}
}

function isYouTubeOrVimeo(url: string | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.includes('youtube.com') || lower.includes('youtu.be') ||
         lower.includes('vimeo.com')
}

function extractVideoFromContent(content: string | undefined): string | undefined {
  if (!content) return undefined

  // Procura por URLs de YouTube ou Vimeo no conteúdo
  const patterns = [
    // YouTube watch URLs
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    // YouTube short URLs
    /https?:\/\/youtu\.be\/[\w-]+/i,
    // YouTube embed URLs
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
    // YouTube nocookie embed
    /https?:\/\/(?:www\.)?youtube-nocookie\.com\/embed\/[\w-]+/i,
    // Vimeo URLs
    /https?:\/\/(?:www\.)?vimeo\.com\/[\d]+/i,
    // Vimeo player
    /https?:\/\/player\.vimeo\.com\/video\/[\d]+/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[0]) return match[0]
  }

  return undefined
}

function extractImageUrlFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined

  // 1) Atributos WordPress / data-* de alta resolução (prioridade)
  const dataAttrMatch = html.match(/data-(?:orig-file|large-file|medium-file|permalink)=["']([^"']+)["']/i)
  if (dataAttrMatch?.[1]) {
    const url = dataAttrMatch[1].trim()
    if (!isYouTubeOrVimeo(url)) return url
  }

  // 2) srcset — pega o maior item (último da lista)
  const srcsetMatch = html.match(/<img[^>]+srcset=["']([^"']+)["']/i)
  if (srcsetMatch?.[1]) {
    const parts = srcsetMatch[1].split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length) {
      const last = parts[parts.length - 1].split(/\s+/)[0]
      if (last && !isYouTubeOrVimeo(last) && !/favicon|icon|logo/i.test(last)) return last
    }
  }

  // 3) Atributos lazy (data-src, data-lazy-src, etc.)
  const lazyMatch = html.match(/<img[^>]+(?:data-src|data-lazy-src|data-original|data-actualsrc)=["']([^"']+)["']/i)
  if (lazyMatch?.[1]) {
    const url = lazyMatch[1].trim()
    if (!isYouTubeOrVimeo(url) && !/favicon|icon|logo/i.test(url)) return url
  }

  // 4) <img src> direto, dentro de <figure> ou <picture>
  let imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (!imgMatch) imgMatch = html.match(/<figure[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
  if (!imgMatch) imgMatch = html.match(/<picture[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) {
    const src = imgMatch[1].trim()
    if (!/favicon|icon|logo/i.test(src) && !isYouTubeOrVimeo(src)) return src
  }

  return undefined
}

function isLikelyDirectImageUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const { pathname } = new URL(url)
    return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(pathname)
  } catch {
    return /\.(avif|gif|jpe?g|png|webp|svg)(\?|$)/i.test(url)
  }
}

async function resolveImageUrl(candidateUrl: string | undefined): Promise<string | undefined> {
  if (!candidateUrl || isYouTubeOrVimeo(candidateUrl)) return undefined
  if (isLikelyDirectImageUrl(candidateUrl)) return candidateUrl

  try {
    const res = await fetch(candidateUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Lophos/1.0; +http://localhost)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return candidateUrl

    const finalUrl = res.url || candidateUrl
    const contentType = (res.headers.get('content-type') || '').toLowerCase()

    if (contentType.startsWith('image/')) {
      return finalUrl
    }

    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await res.text()
      const extracted = extractImageUrlFromHtml(html)
      if (extracted) {
        try {
          return new URL(extracted, finalUrl).href
        } catch {
          return extracted
        }
      }
    }

    return isLikelyDirectImageUrl(finalUrl) ? finalUrl : candidateUrl
  } catch {
    return candidateUrl
  }
}

function extractVideoUrl(item: RSSItem): string | undefined {
  // 1. Procura em media:content[@url] com type=video
  if (item['media:content']?.['@_type']?.includes('video')) {
    const url = item['media:content']['@_url'] || item['media:content']['#text']
    if (isYouTubeOrVimeo(url)) return url
  }

  // 2. Procura em enclosure[@url] com type=video
  if (item.enclosure?.['@_type']?.includes('video')) {
    const url = item.enclosure['@_url']
    if (isYouTubeOrVimeo(url)) return url
  }

  // 3. Procura em media:player
  if (item['media:player']?.['@_url']) {
    const url = item['media:player']['@_url']
    if (isYouTubeOrVimeo(url)) return url
  }

  // 4. Procura no conteúdo (content:encoded ou description)
  const htmlContent = extractText(item['content:encoded']) || extractText(item.description) || ''
  const videoUrl = extractVideoFromContent(htmlContent)
  if (videoUrl) return videoUrl

  return undefined
}

interface RSSFeed {
  id: string
  url: string
  name: string
  topics: string[]
  language: string
  last_etag?: string
  last_modified?: string
}

interface RSSItem {
  title?: string
  link?: string
  description?: string
  'content:encoded'?: string
  pubDate?: string
  'media:content'?: any
  'media:thumbnail'?: any
  'media:player'?: any
  enclosure?: any
  image?: any
}

async function fetchAndParseFeed(feed: RSSFeed): Promise<{ items: RSSItem[]; etag?: string; modified?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    }

    if (feed.last_etag) headers['If-None-Match'] = feed.last_etag
    if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified

    let res = await fetch(feed.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(15000) })

    if ([403, 429, 502, 503, 504].includes(res.status)) {
      await res.body?.cancel()
      await new Promise((resolve) => setTimeout(resolve, 750))
      const retryHeaders: Record<string, string> = { ...headers, 'Cache-Control': 'no-cache' }
      delete retryHeaders['If-None-Match']
      delete retryHeaders['If-Modified-Since']
      res = await fetch(feed.url, { headers: retryHeaders, redirect: 'follow', signal: AbortSignal.timeout(15000) })
    }

    if (res.status === 304) return { items: [] }
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` }

    const xml = await res.text()
    if (!xml.trim()) return { items: [], error: 'Empty response' }

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
      isArray: (name: string) => name === 'item' || name === 'entry',
      processEntities: false,
      allowBooleanAttributes: true,
    })
    const parsed = parser.parse(xml) as any
    const channel = parsed.rss?.channel || parsed.feed || parsed['rdf:RDF']
    if (!channel) return { items: [], error: 'No RSS/Atom channel found' }

    let items = channel.item || []
    if (!Array.isArray(items)) items = items ? [items] : []

    if (!items.length && channel.entry) {
      items = Array.isArray(channel.entry) ? channel.entry : [channel.entry]
      items = items.map((entry: any) => ({
        title: entry.title,
        link: entry.link?.['@_href'] || entry.link,
        description: entry.summary || entry.content?.['#text'] || '',
        pubDate: entry.published || entry.updated,
      }))
    }

    const etag = res.headers.get('etag') || undefined
    const modified = res.headers.get('last-modified') || undefined
    return { items: items.slice(0, 100), etag, modified }
  } catch (err: any) {
    return { items: [], error: err?.message || 'Unknown error' }
  }
}

interface IngestOptions {
  topic?: string | null
  source?: string | null
  retryFailed?: boolean
}

export async function ingestAllFeeds({ topic, source, retryFailed }: IngestOptions) {
  const lock = acquireIngestLock()
  if (!lock.acquired) {
    return { feedsProcessed: 0, itemsAdded: 0, itemsSkipped: 0, errors: [], skipped: true, reason: lock.reason }
  }

  const db = getSupabaseAdmin()
  let rawItemHistoryAvailable = true
  const wasRawItemArchived = async (url: string) => {
    if (!rawItemHistoryAvailable) return false

    const { data, error } = await db
      .from('raw_item_history')
      .select('url')
      .eq('url', url)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) {
        rawItemHistoryAvailable = false
        console.warn('[rss/ingest] raw_item_history is unavailable; apply the retention migration to enable archived URL checks.')
        return false
      }
      throw new Error(`Could not check raw item history: ${error.message}`)
    }

    return Boolean(data)
  }
  try {

  let query = db
    .from('rss_feeds')
    .select('id, url, name, topics, language, last_etag, last_modified, last_error')
    .eq('active', true)

  if (retryFailed) query = query.not('last_error', 'is', null)
  if (topic) query = query.contains('topics', [topic])
  if (source) query = query.ilike('name', `%${source}%`)

  const { data: feeds, error: feedError } = await query

  if (feedError) throw new Error('Database error: ' + feedError.message)
  if (!feeds?.length) return { feedsProcessed: 0, itemsAdded: 0, itemsSkipped: 0, errors: [] }

  console.log(`[rss/ingest] Processing ${feeds.length} feeds`)

  let totalAdded = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const feed of feeds) {
    try {
      const { items, etag, modified, error } = await fetchAndParseFeed(feed as RSSFeed)

      if (error) {
        errors.push(`${feed.name}: ${error}`)
        await db.from('rss_feeds').update({ last_error: error, last_error_at: new Date().toISOString() }).eq('id', feed.id)
        continue
      }

      if (!items.length) continue

      for (const item of items) {
        const title = stripHtml(item.title as string)
        const url = (item.link as string)?.trim()
        const description = stripHtml(extractText(item['content:encoded']) || extractText(item.description) || '')

        if (!title || !url) { totalSkipped++; continue }

        const dedup_hash = createDedupHash(title)
        const itemTopic = inferRssTopic({
          feedTopics: feed.topics as string[],
          title,
          description,
          sourceName: feed.name,
        })

        const { data: existing } = await db.from('raw_items').select('id').eq('url', url).single()
        if (existing) { totalSkipped++; continue }
        if (await wasRawItemArchived(url)) { totalSkipped++; continue }

        let image_url: string | undefined
        const isVideoUrl = (u?: string) => !u ? false : isYouTubeOrVimeo(u) || item['media:content']?.['@_type']?.includes('video')
        if (item['media:content']?.['@_url'] && !isVideoUrl(item['media:content']['@_url'])) {
          image_url = item['media:content']['@_url']
        } else if (item['media:thumbnail']?.['@_url']) {
          image_url = item['media:thumbnail']['@_url']
        } else if (Array.isArray(item['media:thumbnail']) && item['media:thumbnail'][0]?.['@_url']) {
          image_url = item['media:thumbnail'][0]['@_url']
        } else if (item.enclosure?.['@_url'] && item.enclosure['@_type']?.startsWith('image')) {
          image_url = item.enclosure['@_url']
        } else {
          const htmlContent = extractText(item['content:encoded']) || extractText(item.description) || ''
          const extracted = extractImageUrlFromHtml(htmlContent)
          if (extracted) image_url = extracted
        }

        if (image_url) {
          image_url = await resolveImageUrl(image_url)
        }

        // Extrair URL de vídeo (apenas YouTube/Vimeo)
        const video_url = extractVideoUrl(item)

        const pub_date = item.pubDate ? new Date(item.pubDate as string).toISOString() : new Date().toISOString()

        const { error: insertError } = await db.from('raw_items').insert({
          topic: itemTopic, title, url, content: description,
          summary: description.slice(0, 300), source_name: feed.name,
          source_url: feed.url, image_url, video_url, pub_date,
          fetched_at: new Date().toISOString(), dedup_hash, processed: false,
        })

        if (insertError) { totalSkipped++ } else { totalAdded++ }
      }

      await db.from('rss_feeds').update({
        last_fetched: new Date().toISOString(),
        last_etag: etag, last_modified: modified,
        last_error: null, last_error_at: null,
      }).eq('id', feed.id)

    } catch (err: any) {
      errors.push(`${feed.name}: ${err.message}`)
    }
  }

  return { feedsProcessed: feeds.length, itemsAdded: totalAdded, itemsSkipped: totalSkipped, errors: errors.slice(0, 10) }
  } finally {
    releaseIngestLock(lock.fd)
  }
}
