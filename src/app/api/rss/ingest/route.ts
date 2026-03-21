import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────
interface FeedItem {
  title: string
  url: string
  imageUrl?: string
  content?: string
  summary?: string
  pubDate?: string
}

interface Feed {
  id: string
  url: string
  name: string
  topics: string[]
  last_etag: string | null
  last_modified: string | null
}

// ─── Normalize title for dedup hash ──────────────────────────
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|de|da|do|das|dos|o|a|os|as|e|em|no|na|nos|nas|por|para|com|que|se|um|uma)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupHash(title: string): string {
  return crypto.createHash('md5').update(normalizeTitle(title)).digest('hex').slice(0, 16)
}

// ─── Extract image from RSS item ─────────────────────────────
function extractImage(item: any): string | undefined {
  // media:content or media:thumbnail
  if (item['media:content']?.['@_url']) return item['media:content']['@_url']
  if (item['media:thumbnail']?.['@_url']) return item['media:thumbnail']['@_url']
  if (Array.isArray(item['media:content'])) {
    const img = item['media:content'].find((m: any) => m['@_medium'] === 'image' || m['@_url']?.match(/\.(jpg|jpeg|png|webp)/i))
    if (img?.['@_url']) return img['@_url']
  }
  // enclosure
  if (item.enclosure?.['@_url'] && item.enclosure?.['@_type']?.startsWith('image')) {
    return item.enclosure['@_url']
  }
  // og:image from content
  const content = item['content:encoded'] || item.content || item.description || ''
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch) return imgMatch[1]
  return undefined
}

// ─── Parse RSS/Atom feed ──────────────────────────────────────
async function parseFeed(feedUrl: string, etag?: string | null, lastModified?: string | null): Promise<{
  items: FeedItem[]
  etag?: string
  lastModified?: string
  notModified?: boolean
}> {
  const headers: Record<string, string> = {
    'User-Agent': 'LophosFeed/1.0 (+https://lophos.app)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  }
  if (etag) headers['If-None-Match'] = etag
  if (lastModified) headers['If-Modified-Since'] = lastModified

  const res = await fetch(feedUrl, { headers, signal: AbortSignal.timeout(10000) })

  if (res.status === 304) return { items: [], notModified: true }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const xml = await res.text()
  const newEtag = res.headers.get('etag') || undefined
  const newLastModified = res.headers.get('last-modified') || undefined

  // Dynamic import of fast-xml-parser (must be installed)
  const { XMLParser } = await import('fast-xml-parser')
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
  })
  const parsed = parser.parse(xml)

  const channel = parsed?.rss?.channel || parsed?.feed
  if (!channel) throw new Error('Invalid feed format')

  // RSS 2.0
  const rawItems: any[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item ? [channel.item]
    // Atom
    : Array.isArray(channel.entry) ? channel.entry
    : channel.entry ? [channel.entry] : []

  const items: FeedItem[] = rawItems.slice(0, 20).map((item: any) => {
    // Atom uses link.@_href, RSS uses link (text)
    const url = item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || ''
    const title = item.title?.['#text'] || item.title || ''
    const pubDate = item.pubDate || item.updated || item.published || undefined
    const summary = item.description || item.summary?.['#text'] || item.summary || undefined
    const content = item['content:encoded'] || item.content?.['#text'] || undefined

    return {
      title: typeof title === 'string' ? title.trim() : String(title).trim(),
      url: typeof url === 'string' ? url.trim() : String(url).trim(),
      imageUrl: extractImage(item),
      content: content?.slice(0, 2000),
      summary: typeof summary === 'string' ? summary.replace(/<[^>]+>/g, '').slice(0, 500) : undefined,
      pubDate,
    }
  }).filter(item => item.title && item.url)

  return { items, etag: newEtag, lastModified: newLastModified }
}

// ─── Main handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Simple auth: internal secret or service role
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RSS_INGEST_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const body = await req.json().catch(() => ({}))
  const topicFilter: string | null = body.topic || null

  // Load active feeds (optionally filtered by topic)
  let query = db.from('rss_feeds').select('*').eq('active', true)
  if (topicFilter) {
    query = query.contains('topics', [topicFilter])
  }
  const { data: feeds, error } = await query
  if (error || !feeds?.length) {
    return NextResponse.json({ error: 'No feeds found', detail: error?.message })
  }

  let totalNew = 0
  let totalSkipped = 0
  const errors: string[] = []

  // Fetch feeds in parallel (max 5 at a time)
  const chunks = []
  for (let i = 0; i < feeds.length; i += 5) chunks.push(feeds.slice(i, i + 5))

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(async (feed: Feed) => {
      try {
        const { items, etag, lastModified, notModified } = await parseFeed(
          feed.url,
          feed.last_etag,
          feed.last_modified
        )

        // Update last_fetched (and etag/lastModified if changed)
        await db.from('rss_feeds').update({
          last_fetched: new Date().toISOString(),
          ...(etag ? { last_etag: etag } : {}),
          ...(lastModified ? { last_modified: lastModified } : {}),
        }).eq('id', feed.id)

        if (notModified || items.length === 0) return

        // Compute dedup hashes for incoming items
        const hashes = items.map(item => dedupHash(item.title))

        // Check which hashes already exist
        const { data: existing } = await db
          .from('raw_items')
          .select('dedup_hash')
          .in('dedup_hash', hashes)
        const existingHashes = new Set((existing || []).map((r: any) => r.dedup_hash))

        // Filter to only new items
        const newItems = items.filter((_, i) => !existingHashes.has(hashes[i]))

        if (newItems.length === 0) {
          totalSkipped += items.length
          return
        }

        // Insert new items
        const rows = newItems.map((item, i) => ({
          topic: feed.topics[0] || 'Geral', // primary topic of the feed
          title: item.title,
          url: item.url,
          image_url: item.imageUrl || null,
          content: item.content || null,
          summary: item.summary || null,
          source_name: feed.name,
          source_url: feed.url,
          pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          dedup_hash: hashes[items.indexOf(item)],
          processed: false,
        }))

        const { error: insertErr } = await db.from('raw_items').insert(rows)
        if (insertErr) {
          // Ignore unique constraint violations (url already exists)
          if (!insertErr.message.includes('unique')) {
            errors.push(`${feed.name}: ${insertErr.message}`)
          }
        } else {
          totalNew += newItems.length
        }
        totalSkipped += items.length - newItems.length
      } catch (e: any) {
        errors.push(`${feed.name}: ${e.message}`)
      }
    }))
  }

  return NextResponse.json({
    ok: true,
    feeds: feeds.length,
    new: totalNew,
    skipped: totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// GET: quick health check + stats
export async function GET() {
  const db = getSupabaseAdmin()
  const [{ count: total }, { count: unprocessed }, { data: recentFeeds }] = await Promise.all([
    db.from('raw_items').select('*', { count: 'exact', head: true }),
    db.from('raw_items').select('*', { count: 'exact', head: true }).eq('processed', false),
    db.from('rss_feeds').select('name, last_fetched, active').order('last_fetched', { ascending: false }).limit(5),
  ])
  return NextResponse.json({ total, unprocessed, recentFeeds })
}
