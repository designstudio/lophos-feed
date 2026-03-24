import { getSupabaseAdmin } from '@/lib/supabase'
import { XMLParser } from 'fast-xml-parser'
import crypto from 'crypto'

function createDedupHash(title: string): string {
  const normalized = title.toLowerCase().trim()
  return crypto.createHash('md5').update(normalized).digest('hex')
}

function stripHtml(html: any): string {
  if (!html) return ''
  let text = typeof html === 'string' ? html : String(html)
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
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
  enclosure?: any
  image?: any
}

async function fetchAndParseFeed(feed: RSSFeed): Promise<{ items: RSSItem[]; etag?: string; modified?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; Lophos/1.0; +http://localhost)',
    }

    if (feed.last_etag) headers['If-None-Match'] = feed.last_etag
    if (feed.last_modified) headers['If-Modified-Since'] = feed.last_modified

    const res = await fetch(feed.url, { headers, signal: AbortSignal.timeout(15000) })

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
    const channel = parsed.rss?.channel || parsed.feed
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
  const db = getSupabaseAdmin()

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
        const description = stripHtml((item['content:encoded'] || item.description || '') as string)

        if (!title || !url) { totalSkipped++; continue }

        const dedup_hash = createDedupHash(title)
        const itemTopic = ((feed.topics as string[])?.[0] || 'tecnologia').toLowerCase().trim()

        const { data: existing } = await db.from('raw_items').select('id').eq('url', url).single()
        if (existing) { totalSkipped++; continue }

        let image_url: string | undefined
        if (item['media:content']?.['@_url']) {
          image_url = item['media:content']['@_url']
        } else if (item['media:thumbnail']?.['@_url']) {
          image_url = item['media:thumbnail']['@_url']
        } else if (Array.isArray(item['media:thumbnail']) && item['media:thumbnail'][0]?.['@_url']) {
          image_url = item['media:thumbnail'][0]['@_url']
        } else if (item.enclosure?.['@_url'] && item.enclosure['@_type']?.startsWith('image')) {
          image_url = item.enclosure['@_url']
        } else {
          const htmlContent = item['content:encoded'] || item.description || ''
          const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i)
          if (imgMatch?.[1]) {
            const src = imgMatch[1]
            if (!src.includes('favicon') && !src.includes('icon') && !src.includes('logo')) {
              image_url = src
            }
          }
        }

        const pub_date = item.pubDate ? new Date(item.pubDate as string).toISOString() : new Date().toISOString()

        const { error: insertError } = await db.from('raw_items').insert({
          topic: itemTopic, title, url, content: description,
          summary: description.slice(0, 300), source_name: feed.name,
          source_url: feed.url, image_url, pub_date,
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
}
