/**
 * Read-only RSS feed health report.
 *
 * Scans retained raw_items and historical article sources in bounded pages,
 * then correlates them with rss_feeds. It never updates or deletes data.
 */

import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const args = process.argv.slice(2)

function numericOption(name, fallback, { min, max }) {
  const prefix = `--${name}=`
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  if (raw === undefined) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function assertEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage() {
  console.log(`Usage:
  npm run news:feed-health
  npm run news:feed-health -- --all

Options:
  --all                    includes healthy active feeds
  --json                   prints the complete report as JSON
  --stale-days=14          flags feeds without a new raw item after this many days
  --article-stale-days=30  flags feeds without a new article after this many days
  --page-size=1000         rows fetched per read-only database page
  --help`)
}

const showAll = args.includes('--all')
const asJson = args.includes('--json')
const help = args.includes('--help') || args.includes('-h')
const staleDays = numericOption('stale-days', 14, { min: 1, max: 3650 })
const articleStaleDays = numericOption('article-stale-days', 30, { min: 1, max: 3650 })
const pageSize = numericOption('page-size', 1000, { min: 100, max: 1000 })

const db = createClient(
  assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
  assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
)

function ageInDays(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
}

function shortDate(value) {
  if (!value) return 'nunca'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'inválida'
  return new Date(timestamp).toISOString().slice(0, 10)
}

function normalizedHostname(value) {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function classifyFeed(feed) {
  if (!feed.active) return 'INATIVO'
  if (feed.last_error) return 'ERRO'
  if (feed.raw_retained === 0 && feed.article_count === 0) return 'NUNCA GEROU ITEM'
  if (feed.raw_retained > 0 && feed.article_count === 0) return 'NUNCA CONTRIBUIU'
  if (feed.last_raw_age_days === null || feed.last_raw_age_days >= staleDays) return 'SEM ITENS RECENTES'
  if (feed.last_article_age_days === null || feed.last_article_age_days >= articleStaleDays) return 'SEM CONTRIBUIÇÃO RECENTE'
  return 'OK'
}

async function scanTable(table, select, onRows) {
  let offset = 0
  let scanned = 0

  while (true) {
    const { data, error } = await db
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`${table} page ${Math.floor(offset / pageSize) + 1} failed: ${error.message}`)
    const rows = data ?? []
    onRows(rows)
    scanned += rows.length
    if (!asJson && scanned > 0 && scanned % 10_000 === 0) console.log(`[feed-health] ${table}: ${scanned} rows scanned`)
    if (rows.length < pageSize) return scanned
    offset += pageSize
  }
}

function createStats(feed) {
  return {
    ...feed,
    raw_retained: 0,
    raw_processed: 0,
    raw_pending: 0,
    last_raw_at: null,
    last_raw_published_at: null,
    latest_raw_processed: null,
    article_count: 0,
    last_article_at: null,
    last_article_title: null,
    article_attribution_shared: false,
    article_host_fallback_count: 0,
  }
}

async function main() {
  if (help) {
    printUsage()
    return
  }

  const { data: feeds, error } = await db
    .from('rss_feeds')
    .select('id, name, url, topics, language, active, last_fetched, last_error, last_error_at')
    .order('name', { ascending: true })

  if (error) throw new Error(`Could not load rss_feeds: ${error.message}`)

  const statsByFeedId = new Map((feeds ?? []).map((feed) => [feed.id, createStats(feed)]))
  const feedByUrl = new Map((feeds ?? []).map((feed) => [feed.url, feed]))
  const feedsByName = new Map()
  for (const feed of feeds ?? []) {
    const entries = feedsByName.get(feed.name) ?? []
    entries.push(feed)
    feedsByName.set(feed.name, entries)
  }

  const rawFeedById = new Map()
  const feedIdsByArticleHost = new Map()
  const rawScanned = await scanTable(
    'raw_items',
    'id, url, source_url, source_name, fetched_at, pub_date, processed',
    (rows) => {
      for (const row of rows) {
        const exactFeed = feedByUrl.get(row.source_url)
        const nameFeeds = feedsByName.get(row.source_name) ?? []
        const feed = exactFeed ?? (nameFeeds.length === 1 ? nameFeeds[0] : null)
        if (!feed) continue

        rawFeedById.set(String(row.id), feed.id)
        const articleHost = normalizedHostname(row.url)
        if (articleHost) {
          const hostFeedIds = feedIdsByArticleHost.get(articleHost) ?? new Set()
          hostFeedIds.add(feed.id)
          feedIdsByArticleHost.set(articleHost, hostFeedIds)
        }
        const stats = statsByFeedId.get(feed.id)
        stats.raw_retained += 1
        if (row.processed) stats.raw_processed += 1
        else stats.raw_pending += 1
        if (!stats.last_raw_at || Date.parse(row.fetched_at) > Date.parse(stats.last_raw_at)) {
          stats.last_raw_at = row.fetched_at
          stats.last_raw_published_at = row.pub_date
          stats.latest_raw_processed = row.processed
        }
      }
    },
  )

  const articleScanned = await scanTable(
    'articles',
    'id, title, published_at, cached_at, sources, source_ids',
    (rows) => {
      for (const article of rows) {
        const attributedFeedIds = new Set()

        for (const rawId of article.source_ids ?? []) {
          const feedId = rawFeedById.get(String(rawId))
          if (feedId) attributedFeedIds.add(feedId)
        }

        for (const source of Array.isArray(article.sources) ? article.sources : []) {
          const matchingFeeds = feedsByName.get(String(source?.name ?? '').trim()) ?? []
          if (matchingFeeds.length === 1) {
            attributedFeedIds.add(matchingFeeds[0].id)
          } else if (matchingFeeds.length > 1) {
            for (const feed of matchingFeeds) {
              attributedFeedIds.add(feed.id)
              statsByFeedId.get(feed.id).article_attribution_shared = true
            }
          }

          const sourceHost = normalizedHostname(source?.url)
          const hostFeedIds = sourceHost ? feedIdsByArticleHost.get(sourceHost) : null
          if (hostFeedIds?.size === 1) {
            const [feedId] = hostFeedIds
            if (!attributedFeedIds.has(feedId)) {
              attributedFeedIds.add(feedId)
              statsByFeedId.get(feedId).article_host_fallback_count += 1
            }
          }
        }

        // cached_at is when Lophos generated/cached the article; published_at is
        // the source story date and may be considerably older.
        const articleAt = article.cached_at ?? article.published_at ?? null
        for (const feedId of attributedFeedIds) {
          const stats = statsByFeedId.get(feedId)
          if (!stats) continue
          stats.article_count += 1
          if (articleAt && (!stats.last_article_at || Date.parse(articleAt) > Date.parse(stats.last_article_at))) {
            stats.last_article_at = articleAt
            stats.last_article_title = article.title
          }
        }
      }
    },
  )

  const report = [...statsByFeedId.values()].map((feed) => {
    const enriched = {
      ...feed,
      last_raw_age_days: ageInDays(feed.last_raw_at),
      last_article_age_days: ageInDays(feed.last_article_at),
    }
    return { ...enriched, status: classifyFeed(enriched) }
  })

  const statusOrder = ['ERRO', 'NUNCA GEROU ITEM', 'NUNCA CONTRIBUIU', 'SEM ITENS RECENTES', 'SEM CONTRIBUIÇÃO RECENTE', 'INATIVO', 'OK']
  report.sort((left, right) => statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status)
    || left.name.localeCompare(right.name, 'pt-BR'))

  if (asJson) {
    console.log(JSON.stringify({
      generated_at: new Date().toISOString(),
      stale_days: staleDays,
      article_stale_days: articleStaleDays,
      scanned: { raw_items: rawScanned, articles: articleScanned },
      feeds: report,
    }, null, 2))
    return
  }

  const visible = showAll ? report : report.filter((feed) => feed.status !== 'OK')
  console.table(visible.map((feed) => ({
    status: feed.status,
    feed: feed.name,
    ativo: feed.active ? 'sim' : 'não',
    itens_retidos: feed.raw_retained,
    pendentes: feed.raw_pending,
    último_item: shortDate(feed.last_raw_at),
    contribuições: feed.article_count,
    última_contribuição: shortDate(feed.last_article_at),
    última_leitura: shortDate(feed.last_fetched),
    erro: feed.last_error ? String(feed.last_error).slice(0, 90) : '',
  })))

  const counts = Object.fromEntries(statusOrder
    .filter((status) => report.some((feed) => feed.status === status))
    .map((status) => [status, report.filter((feed) => feed.status === status).length]))
  console.log(`[feed-health] scanned raw_items=${rawScanned} articles=${articleScanned}`)
  console.log(`[feed-health] total=${report.length} shown=${visible.length} ${Object.entries(counts).map(([status, count]) => `${status.toLowerCase().replaceAll(' ', '_')}=${count}`).join(' ')}`)
  console.log('[feed-health] Itens cobrem somente a retenção atual; contribuições contam artigos que registram este feed como fonte.')
  console.log('[feed-health] Um artigo recente do mesmo tema ou portal não é atribuído ao feed sem vínculo direto, evitando falsos positivos em portais com vários feeds.')
  if (report.some((feed) => feed.article_attribution_shared)) {
    console.log('[feed-health] Feeds with duplicate names share historical article attribution when old raw item links are no longer retained.')
  }
  const hostFallbacks = report.reduce((total, feed) => total + feed.article_host_fallback_count, 0)
  if (hostFallbacks > 0) {
    console.log(`[feed-health] ${hostFallbacks} atribuições usaram o domínio do artigo porque ele corresponde a um único feed do catálogo.`)
  }
  console.log('[feed-health] No data was changed. Prefer active=false before permanently deleting a feed.')
}

main().catch((error) => {
  console.error(`[feed-health] Fatal error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
