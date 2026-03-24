/**
 * Standalone RSS ingest script — runs directly with Node.js (no Next.js needed).
 * Used by GitHub Actions every 6 hours.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'
import crypto from 'crypto'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function createDedupHash(title) {
  return crypto.createHash('md5').update(title.toLowerCase().trim()).digest('hex')
}

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

async function fetchAndParseFeed(feed) {
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; Lophos/1.0; +http://localhost)' }
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
      isArray: (name) => name === 'item' || name === 'entry',
      processEntities: false,
      allowBooleanAttributes: true,
    })
    const parsed = parser.parse(xml)
    const channel = parsed.rss?.channel || parsed.feed
    if (!channel) return { items: [], error: 'No RSS/Atom channel found' }

    let items = channel.item || []
    if (!Array.isArray(items)) items = items ? [items] : []

    if (!items.length && channel.entry) {
      items = Array.isArray(channel.entry) ? channel.entry : [channel.entry]
      items = items.map((entry) => ({
        title: entry.title,
        link: entry.link?.['@_href'] || entry.link,
        description: entry.summary || entry.content?.['#text'] || '',
        pubDate: entry.published || entry.updated,
      }))
    }

    const etag = res.headers.get('etag') || undefined
    const modified = res.headers.get('last-modified') || undefined
    return { items: items.slice(0, 100), etag, modified }
  } catch (err) {
    return { items: [], error: err?.message || 'Unknown error' }
  }
}

async function main() {
  const { data: feeds, error: feedError } = await db
    .from('rss_feeds')
    .select('id, url, name, topics, language, last_etag, last_modified')
    .eq('active', true)

  if (feedError) throw new Error('Database error: ' + feedError.message)
  if (!feeds?.length) {
    console.log('No active feeds found.')
    return
  }

  console.log(`Processing ${feeds.length} feeds...`)

  let totalAdded = 0
  let totalSkipped = 0
  const errors = []

  for (const feed of feeds) {
    try {
      const { items, etag, modified, error } = await fetchAndParseFeed(feed)

      if (error) {
        errors.push(`${feed.name}: ${error}`)
        await db.from('rss_feeds').update({ last_error: error, last_error_at: new Date().toISOString() }).eq('id', feed.id)
        continue
      }

      if (!items.length) continue

      for (const item of items) {
        const title = stripHtml(item.title)
        const url = item.link?.trim()
        const description = stripHtml(item['content:encoded'] || item.description || '')

        if (!title || !url) { totalSkipped++; continue }

        const dedup_hash = createDedupHash(title)
        const itemTopic = (feed.topics?.[0] || 'tecnologia').toLowerCase().trim()

        const { data: existing } = await db.from('raw_items').select('id').eq('url', url).single()
        if (existing) { totalSkipped++; continue }

        let image_url
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

        const pub_date = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()

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

      console.log(`✅ ${feed.name}`)
    } catch (err) {
      errors.push(`${feed.name}: ${err.message}`)
      console.error(`❌ ${feed.name}: ${err.message}`)
    }
  }

  console.log(`\nDone! feeds=${feeds.length} added=${totalAdded} skipped=${totalSkipped} errors=${errors.length}`)
  if (errors.length) console.error('Errors:', errors)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
