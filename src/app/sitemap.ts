import type { MetadataRoute } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase'

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lophos.space'
const PAGE_SIZE = 1000
const MAX_SITEMAP_URLS = 50_000

type ArticleSitemapRow = {
  id: string
  published_at: string | null
  cached_at: string | null
}

type EditorialListSitemapRow = {
  slug: string
  updated_at: string | null
  published_at: string | null
}

const staticEntries: MetadataRoute.Sitemap = [
  { url: SITE_URL },
  { url: `${SITE_URL}/lists` },
  { url: `${SITE_URL}/notas-de-versao` },
  { url: `${SITE_URL}/politica-de-privacidade` },
  { url: `${SITE_URL}/termos-de-uso` },
]

async function getPublishedLists(): Promise<EditorialListSitemapRow[]> {
  const rows: EditorialListSitemapRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getSupabaseAdmin()
      .from('editorial_lists')
      .select('slug,updated_at,published_at')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error

    const page = (data || []) as EditorialListSitemapRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function getArticles(limit: number): Promise<ArticleSitemapRow[]> {
  const rows: ArticleSitemapRow[] = []

  for (let from = 0; from < limit; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, limit) - 1
    const { data, error } = await getSupabaseAdmin()
      .from('articles')
      .select('id,published_at,cached_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    const page = (data || []) as ArticleSitemapRow[]
    rows.push(...page)
    if (page.length < to - from + 1) break
  }

  return rows
}

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const lists = await getPublishedLists()
    const articleLimit = Math.max(0, MAX_SITEMAP_URLS - staticEntries.length - lists.length)
    const articles = await getArticles(articleLimit)

    const listEntries: MetadataRoute.Sitemap = lists.map((list) => ({
      url: `${SITE_URL}/lists/${encodeURIComponent(list.slug)}`,
      lastModified: list.updated_at || list.published_at || undefined,
    }))

    const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
      url: `${SITE_URL}/article/${article.id}`,
      lastModified: article.cached_at || article.published_at || undefined,
    }))

    return [...staticEntries, ...listEntries, ...articleEntries]
  } catch (error) {
    console.error('[sitemap] failed to load dynamic URLs:', error)
    return staticEntries
  }
}
