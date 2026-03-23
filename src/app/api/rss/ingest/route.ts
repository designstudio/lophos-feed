import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { XMLParser } from 'fast-xml-parser'
import crypto from 'crypto'

// Create dedup hash from normalized title
function createDedupHash(title: string): string {
  const normalized = title.toLowerCase().trim()
  return crypto.createHash('md5').update(normalized).digest('hex')
}

// Extract text content from HTML
function stripHtml(html: any): string {
  if (!html) return ''

  // Convert to string if it's an object
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

    // 304 Not Modified — feed hasn't changed
    if (res.status === 304) {
      return { items: [] }
    }

    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` }
    }

    const xml = await res.text()
    if (!xml.trim()) {
      return { items: [], error: 'Empty response' }
    }

    // Parse XML with entity expansion disabled to prevent XXE and entity expansion attacks
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: true,
      trimValues: true,
      isArray: (name: string) => name === 'item' || name === 'entry',
      processEntities: false, // Disable entity processing
      allowBooleanAttributes: true,
    })
    const parsed = parser.parse(xml) as any

    // Extract items from RSS or Atom feed
    const channel = parsed.rss?.channel || parsed.feed
    if (!channel) {
      return { items: [], error: 'No RSS/Atom channel found' }
    }

    let items = channel.item || []
    if (!Array.isArray(items)) {
      items = items ? [items] : []
    }

    // For Atom feeds, rename "entry" to "item" structure
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

    return { items: items.slice(0, 100), etag, modified } // Limit to 100 items per feed
  } catch (err: any) {
    return {
      items: [],
      error: err?.message || 'Unknown error',
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate with Bearer token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const expectedToken = process.env.RSS_INGEST_SECRET

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getSupabaseAdmin()

    // Check if this is a retry for failed feeds
    const url = new URL(req.url)
    const retryFailed = url.searchParams.get('retry') === 'failed'

    // 1. Fetch feeds (all active, or only failed if retry mode)
    let query = db
      .from('rss_feeds')
      .select('id, url, name, topics, language, last_etag, last_modified, last_error')
      .eq('active', true)

    if (retryFailed) {
      query = query.not('last_error', 'is', null) // Only feeds with errors
    }

    const { data: feeds, error: feedError } = await query

    if (feedError) {
      console.error('[rss/ingest] feeds error:', feedError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!feeds?.length) {
      return NextResponse.json({ feedsProcessed: 0, itemsAdded: 0, itemsSkipped: 0, errors: [] })
    }

    console.log(`[rss/ingest] Processing ${feeds.length} feeds`)

    let totalAdded = 0
    let totalSkipped = 0
    const errors: string[] = []

    // 2. Process each feed
    for (const feed of feeds) {
      try {
        const { items, etag, modified, error } = await fetchAndParseFeed(feed as RSSFeed)

        if (error) {
          console.warn(`[rss/ingest] ${feed.name}: ${error}`)
          errors.push(`${feed.name}: ${error}`)

          // Save error to database
          await db
            .from('rss_feeds')
            .update({
              last_error: error,
              last_error_at: new Date().toISOString(),
            })
            .eq('id', feed.id)

          continue
        }

        if (!items.length) {
          console.log(`[rss/ingest] ${feed.name}: No items (possibly 304 Not Modified)`)
          continue
        }

        console.log(`[rss/ingest] ${feed.name}: ${items.length} items`)

        // 3. Process items
        for (const item of items) {
          const title = stripHtml(item.title as string)
          const url = (item.link as string)?.trim()
          const description = stripHtml((item.description || item['content:encoded'] || '') as string)

          if (!title || !url) {
            totalSkipped++
            continue
          }

          const dedup_hash = createDedupHash(title)
          const topic = (feed.topics as string[])?.[0] || 'tecnologia'

          // Check for duplicate by URL (unique constraint)
          const { data: existing } = await db
            .from('raw_items')
            .select('id')
            .eq('url', url)
            .single()

          if (existing) {
            totalSkipped++
            continue
          }

          // Extract image from item or feed
          let image_url: string | undefined
          if (item['media:content']?.['@_url']) {
            image_url = item['media:content']['@_url']
          } else if (item.enclosure?.['@_url'] && item.enclosure['@_type']?.startsWith('image')) {
            image_url = item.enclosure['@_url']
          }

          // Parse pub_date
          const pub_date = item.pubDate ? new Date(item.pubDate as string).toISOString() : new Date().toISOString()

          // Insert into raw_items
          const { error: insertError } = await db.from('raw_items').insert({
            topic,
            title,
            url,
            content: description,
            summary: description.slice(0, 300),
            source_name: feed.name,
            source_url: feed.url,
            image_url,
            pub_date,
            fetched_at: new Date().toISOString(),
            dedup_hash,
            processed: false,
          })

          if (insertError) {
            console.error(`[rss/ingest] Insert error for ${title}:`, insertError.message)
            totalSkipped++
          } else {
            totalAdded++
          }
        }

        // 4. Update feed metadata and clear any previous errors
        await db
          .from('rss_feeds')
          .update({
            last_fetched: new Date().toISOString(),
            last_etag: etag,
            last_modified: modified,
            last_error: null, // Clear error on success
            last_error_at: null,
          })
          .eq('id', feed.id)

        console.log(`[rss/ingest] ✓ ${feed.name}: added=${items.length}, errors=${errors.length}`)
      } catch (err: any) {
        console.error(`[rss/ingest] ✗ ${feed.name}:`, err.message)
        errors.push(`${feed.name}: ${err.message}`)
      }
    }

    console.log(`[rss/ingest] Complete: added=${totalAdded}, skipped=${totalSkipped}, errors=${errors.length}`)

    return NextResponse.json({
      feedsProcessed: feeds.length,
      itemsAdded: totalAdded,
      itemsSkipped: totalSkipped,
      errors: errors.slice(0, 10), // Limit error list to first 10
    })
  } catch (err: any) {
    console.error('[rss/ingest] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
