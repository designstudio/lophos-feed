import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GEMINI_KEY = process.env.GEMINI_API_KEY!

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

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|de|da|do|das|dos|o|a|os|as|e|em|no|na|nos|nas|por|para|com|que|se|um|uma)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupHash(title: string): string {
  return crypto.createHash('md5').update(normalizeTitle(title)).digest('hex').slice(0, 16)
}

function extractImage(item: any): string | undefined {
  if (item['media:content']?.['@_url']) return item['media:content']['@_url']
  if (item['media:thumbnail']?.['@_url']) return item['media:thumbnail']['@_url']
  if (Array.isArray(item['media:content'])) {
    const img = item['media:content'].find((m: any) => m['@_medium'] === 'image' || m['@_url']?.match(/\.(jpg|jpeg|png|webp)/i))
    if (img?.['@_url']) return img['@_url']
  }
  if (item.enclosure?.['@_url'] && item.enclosure?.['@_type']?.startsWith('image')) {
    return item.enclosure['@_url']
  }
  const content = (typeof item['content:encoded'] === 'string' ? item['content:encoded'] : '') ||
    (typeof item.description === 'string' ? item.description : '') || ''
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch) return imgMatch[1]
  return undefined
}

async function parseFeed(feedUrl: string, etag?: string | null, lastModified?: string | null) {
  const headers: Record<string, string> = {
    'User-Agent': 'LophosFeed/1.0',
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

  const { XMLParser } = await import('fast-xml-parser')
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', allowBooleanAttributes: true })
  const parsed = parser.parse(xml)

  const channel = parsed?.rss?.channel || parsed?.feed || parsed?.['rdf:RDF']?.channel
  if (!channel) throw new Error('Invalid feed format')

  const rawItems: any[] = Array.isArray(channel.item) ? channel.item
    : channel.item ? [channel.item]
    : Array.isArray(channel.entry) ? channel.entry
    : channel.entry ? [channel.entry] : []

  const items: FeedItem[] = rawItems.slice(0, 20).map((item: any) => {
    const url = item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || ''
    const title = item.title?.['#text'] || item.title || ''
    const pubDate = item.pubDate || item.updated || item.published || undefined
    const summary = item.description || item.summary?.['#text'] || item.summary || undefined
    const content = (typeof item['content:encoded'] === 'string' ? item['content:encoded'] : item['content:encoded']?.['#text']) ||
      (typeof item.content === 'string' ? item.content : item.content?.['#text']) || undefined

    return {
      title: typeof title === 'string' ? title.trim() : String(title).trim(),
      url: typeof url === 'string' ? url.trim() : String(url).trim(),
      imageUrl: extractImage(item),
      content: content?.replace(/<[^>]+>/g, '').slice(0, 1000),
      summary: typeof summary === 'string' ? summary.replace(/<[^>]+>/g, '').slice(0, 500) : undefined,
      pubDate,
    }
  }).filter(item => item.title && item.url)

  return { items, etag: newEtag, lastModified: newLastModified }
}

// ─── Generate embedding via Gemini ────────────────────────────
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: text.slice(0, 2000) }] },
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.embedding?.values ?? null
  } catch {
    return null
  }
}

// ─── Generate embeddings in batches ──────────────────────────
async function embedItems(items: any[]): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>()
  // Process 5 at a time to avoid rate limits
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5)
    await Promise.all(batch.map(async (item) => {
      const text = `${item.title}. ${item.summary || item.content || ''}`.slice(0, 2000)
      const embedding = await generateEmbedding(text)
      if (embedding) results.set(item.url, embedding)
    }))
    // Small delay between batches
    if (i + 5 < items.length) await new Promise(r => setTimeout(r, 200))
  }
  return results
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RSS_INGEST_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const body = await req.json().catch(() => ({}))
  const topicFilter: string | null = body.topic || null

  let query = db.from('rss_feeds').select('*').eq('active', true)
  if (topicFilter) query = query.contains('topics', [topicFilter])

  const { data: feeds, error } = await query
  if (error || !feeds?.length) {
    return NextResponse.json({ error: 'No feeds found', detail: error?.message })
  }

  let totalNew = 0
  let totalSkipped = 0
  let totalEmbedded = 0
  const errors: string[] = []

  const chunks = []
  for (let i = 0; i < feeds.length; i += 5) chunks.push(feeds.slice(i, i + 5))

  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(async (feed: Feed) => {
      try {
        const { items, etag, lastModified, notModified } = await parseFeed(feed.url, feed.last_etag, feed.last_modified)

        await db.from('rss_feeds').update({
          last_fetched: new Date().toISOString(),
          ...(etag ? { last_etag: etag } : {}),
          ...(lastModified ? { last_modified: lastModified } : {}),
        }).eq('id', feed.id)

        if (notModified || items.length === 0) return

        const hashes = items.map(item => dedupHash(item.title))
        const { data: existing } = await db.from('raw_items').select('dedup_hash').in('dedup_hash', hashes)
        const existingHashes = new Set((existing || []).map((r: any) => r.dedup_hash))
        const newItems = items.filter((_, i) => !existingHashes.has(hashes[i]))

        if (newItems.length === 0) { totalSkipped += items.length; return }

        // Generate embeddings for new items
        const embeddings = await embedItems(newItems.map((item, i) => ({
          url: item.url,
          title: item.title,
          summary: item.summary,
          content: item.content,
        })))
        totalEmbedded += embeddings.size

        const rows = newItems.map((item, i) => ({
          topic: feed.topics[0] || 'Geral',
          title: item.title,
          url: item.url,
          image_url: item.imageUrl || null,
          content: item.content || null,
          summary: item.summary || null,
          source_name: feed.name,
          source_url: feed.url,
          pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          dedup_hash: hashes[items.indexOf(item)],
          embedding: embeddings.get(item.url) ? `[${embeddings.get(item.url)!.join(',')}]` : null,
          processed: false,
        }))

        const { error: insertErr } = await db.from('raw_items').insert(rows)
        if (insertErr) {
          if (!insertErr.message.includes('unique')) errors.push(`${feed.name}: ${insertErr.message}`)
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
    ok: true, feeds: feeds.length,
    new: totalNew, skipped: totalSkipped, embedded: totalEmbedded,
    errors: errors.length > 0 ? errors : undefined,
  })
}

export async function GET() {
  const db = getSupabaseAdmin()
  const [{ count: total }, { count: unprocessed }, { count: withEmbedding }] = await Promise.all([
    db.from('raw_items').select('*', { count: 'exact', head: true }),
    db.from('raw_items').select('*', { count: 'exact', head: true }).eq('processed', false),
    db.from('raw_items').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
  ])
  return NextResponse.json({ total, unprocessed, withEmbedding })
}
