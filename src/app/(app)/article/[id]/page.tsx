import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArticlePageClient from '@/components/ArticlePageClient'
import { getSupabaseAdmin } from '@/lib/supabase'

type ArticleMetadataRow = {
  id: string
  title: string
  summary: string
  image_url: string | null
  published_at: string
}

async function getArticleForMetadata(id: string): Promise<ArticleMetadataRow | null> {
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('articles')
    .select('id, title, summary, image_url, published_at')
    .eq('id', id)
    .maybeSingle()

  return data
}

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
  const article = await getArticleForMetadata(id)

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
  const imageUrl = article.image_url
    ? `${siteUrl}/api/image-proxy?url=${encodeURIComponent(article.image_url)}`
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
      publishedTime: article.published_at,
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
  const article = await getArticleForMetadata(id)

  if (!article) {
    notFound()
  }

  return <ArticlePageClient key={id} />
}
