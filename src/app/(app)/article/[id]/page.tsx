import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import ArticlePageClient from '@/components/ArticlePageClient'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { NewsItem } from '@/lib/types'

type ArticleRow = {
  id: string
  topic: string
  title: string
  summary: string
  sections: NewsItem['sections'] | null
  conclusion: string | null
  sources: NewsItem['sources'] | null
  image_url: string | null
  video_url: string | null
  published_at: string
  cached_at: string | null
  matched_topics: string[] | null
}

const getArticle = cache(async (id: string): Promise<NewsItem | null> => {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('articles')
    .select('id, topic, title, summary, sections, conclusion, sources, image_url, video_url, published_at, cached_at, matched_topics')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  const row = data as ArticleRow

  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    sections: row.sections ?? [],
    conclusion: row.conclusion ?? undefined,
    sources: row.sources ?? [],
    imageUrl: row.image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    publishedAt: row.published_at,
    cachedAt: row.cached_at ?? row.published_at,
    matchedTopics: row.matched_topics ?? undefined,
  }
})

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://lophos.space'
}

function truncateDescription(text: string, maxLength = 180) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trimEnd()}...`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    return {
      title: 'Lophos',
      description: 'Seu feed de noticias personalizado por IA.',
    }
  }

  const siteUrl = getSiteUrl()
  const url = `${siteUrl}/article/${article.id}`
  const title = `${article.title} - Lophos`
  const description = truncateDescription(article.summary || 'Leia esta noticia no Lophos.')
  const imageUrl = article.imageUrl
    ? `${siteUrl}/api/image-proxy?url=${encodeURIComponent(article.imageUrl)}`
    : null
  const images = imageUrl
    ? [
        {
          url: imageUrl,
          alt: article.title,
        },
      ]
    : undefined

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      url,
      siteName: 'Lophos',
      locale: 'pt_BR',
      title: article.title,
      description,
      publishedTime: article.publishedAt,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: article.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const article = await getArticle(id)

  if (!article) {
    notFound()
  }

  return <ArticlePageClient key={id} initialItem={article} />
}
