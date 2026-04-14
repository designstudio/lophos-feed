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

const HARD_BLOCK_PATTERNS = [
  /\bcasino(s)?\b/i,
  /\bcassino(s)?\b/i,
  /\bgambling\b/i,
  /\bbet(ting)?\b/i,
  /\bapostas?\b/i,
  /\bslots?\b/i,
  /\bpoker\b/i,
  /\broulette\b/i,
  /\broleta\b/i,
  /\bjackpot\b/i,
  /\bbonus\b/i,
  /\bb[oô]nus\b/i,
  /\bno deposit\b/i,
  /\bsem dep[oó]sito\b/i,
  /\bsweepstakes?\b/i,
  /\bbookmaker\b/i,
  /\bcassino online\b/i,
]

const DEAL_HINT_PATTERNS = [
  /\bdesconto\b/i,
  /\bdescontos\b/i,
  /\bpromo(cao|ção|coes|ções)\b/i,
  /\boferta(s)?\b/i,
  /\bcupom(ns)?\b/i,
  /\bcoupon(s)?\b/i,
  /\bblack friday\b/i,
  /\bdeal(s)?\b/i,
  /\bliquida(cao|ção)\b/i,
  /\bfrete gr[aá]tis\b/i,
  /\bgr[aá]tis\b/i,
  /\beconomize\b/i,
  /\bimperd[ií]vel\b/i,
  /\bmais barato\b/i,
  /\bmenor pre[cç]o\b/i,
  /\bpre[cç]o baixo\b/i,
  /\bpor r\$/i,
  /\bpor us\$/i,
  /\b\d{1,3}%\s*(off|de desconto)\b/i,
]

const DEAL_SOURCE_HINTS = [
  'promobit',
  'pelando',
  'buscape',
  'zoom.com',
  'cuponomia',
  'meliuz',
]

const ARCHIVE_HINT_PATTERNS = [
  /\barquivos?\b/i,
  /\barquivo(s)?\b/i,
  /\barchive(s)?\b/i,
  /\broundup(s)?\b/i,
  /\bcollection\b/i,
]

const LISTICLE_HINT_PATTERNS = [
  /\b\d+\s+(melhores|ofertas|op[çc]oes|opções|produtos|itens|motivos)\b/i,
  /\b(top|ranking|lista|guia|sele(c|ç)(ao|ão))\b/i,
  /\b(confira|check out|veja|clique)\b/i,
]

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

function shouldRejectRawItem({ title, description, url, sourceName }) {
  const haystack = [title, description, url, sourceName].filter(Boolean).join(' \n ').toLowerCase()

  if (ARCHIVE_HINT_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { reject: true, reason: 'blocked-archive' }
  }

  if (matchesAnyPattern(haystack, HARD_BLOCK_PATTERNS)) {
    return { reject: true, reason: 'blocked-gambling' }
  }

  const dealSignals = DEAL_HINT_PATTERNS.filter((pattern) => pattern.test(haystack)).length
  const listicleSignals = LISTICLE_HINT_PATTERNS.filter((pattern) => pattern.test(haystack)).length
  const sourceLooksPromo = DEAL_SOURCE_HINTS.some((hint) => haystack.includes(hint))

  if (dealSignals >= 2 || (dealSignals >= 1 && (sourceLooksPromo || listicleSignals >= 1))) {
    return { reject: true, reason: 'blocked-deal' }
  }

  return { reject: false, reason: null }
}

function extractText(val) {
  if (!val) return ''
  // Some parsers return { '#text': '...', '@_type': 'html' } instead of a plain string
  if (typeof val === 'object') return val['#text'] || ''
  return String(val)
}

function stripHtml(html) {
  const text = extractText(html)
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function isYouTubeOrVimeo(url) {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')
}

function extractVideoFromContent(content) {
  if (!content) return undefined
  const patterns = [
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/i,
    /https?:\/\/youtu\.be\/[\w-]+/i,
    /https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/i,
    /https?:\/\/(?:www\.)?youtube-nocookie\.com\/embed\/[\w-]+/i,
    /https?:\/\/(?:www\.)?vimeo\.com\/[\d]+/i,
    /https?:\/\/player\.vimeo\.com\/video\/[\d]+/i,
  ]
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[0]) return match[0]
  }
  return undefined
}

function extractVideoUrl(item) {
  if (item['media:content']?.['@_type']?.includes('video')) {
    const url = item['media:content']['@_url'] || item['media:content']['#text']
    if (isYouTubeOrVimeo(url)) return url
  }
  if (item.enclosure?.['@_type']?.includes('video')) {
    const url = item.enclosure['@_url']
    if (isYouTubeOrVimeo(url)) return url
  }
  if (item['media:player']?.['@_url']) {
    const url = item['media:player']['@_url']
    if (isYouTubeOrVimeo(url)) return url
  }
  const htmlContent = extractText(item['content:encoded']) || extractText(item.description) || ''
  return extractVideoFromContent(htmlContent)
}

function extractImageUrlFromHtml(html) {
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

function isLikelyDirectImageUrl(url) {
  if (!url) return false
  try {
    const { pathname } = new URL(url)
    return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(pathname)
  } catch {
    return /\.(avif|gif|jpe?g|png|webp|svg)(\?|$)/i.test(url)
  }
}

async function resolveImageUrl(candidateUrl) {
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

    // RSS 2.0, Atom, or RSS 1.0 (RDF)
    const channel = parsed.rss?.channel || parsed.feed || parsed['rdf:RDF']
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
        const description = stripHtml(extractText(item['content:encoded']) || extractText(item.description) || '')

        if (!title || !url) { totalSkipped++; continue }

        const rawDecision = shouldRejectRawItem({
          title,
          description,
          url,
          sourceName: feed.name,
        })
        if (rawDecision.reject) {
          totalSkipped++
          console.log(`⛔ ${feed.name}: ${rawDecision.reason} | ${title.slice(0, 90)}`)
          continue
        }

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
          const htmlContent = extractText(item['content:encoded']) || extractText(item.description) || ''
          const extracted = extractImageUrlFromHtml(htmlContent)
          if (extracted) image_url = extracted
        }

        if (image_url) {
          image_url = await resolveImageUrl(image_url)
        }

        const video_url = extractVideoUrl(item)

        const pub_date = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()

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
