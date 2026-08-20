import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { Clock } from '@untitledui/icons'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EditorialDocumentView } from '@/components/editorial/EditorialDocument'
import { EditorialListActions } from '@/components/editorial/EditorialListActions'
import { ZoomableEditorialImage } from '@/components/editorial/ZoomableEditorialImage'
import type { EditorialDocument, EditorialListRecord, EditorialNode } from '@/components/editorial/editorial-types'
import { TopicIcon } from '@/components/TopicIcon'
import { getSupabaseAdmin } from '@/lib/supabase'

const PUBLIC_LIST_COLUMNS = [
  'id',
  'slug',
  'title',
  'content_json',
  'cover_image_url',
  'cover_image_alt',
  'cover_image_credit',
  'topic',
  'matched_topics',
  'keywords',
  'seo_title',
  'seo_description',
  'status',
  'author_name',
  'author_image_url',
  'published_at',
  'created_at',
  'updated_at',
].join(',')

const getPublishedList = cache(async (slug: string): Promise<EditorialListRecord | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from('editorial_lists')
    .select(PUBLIC_LIST_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error(`[editorial-list] published lookup failed for ${slug}:`, error)
    throw new Error('Não foi possível carregar esta lista agora.')
  }

  return data as EditorialListRecord | null
})

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://lophos.space'
}

function documentText(document: EditorialDocument) {
  const readNode = (node: EditorialNode): string => {
    if (node.type === 'text') return node.text || ''
    return (node.content || []).map(readNode).join(' ')
  }
  return (document.content || []).map(readNode).join(' ').replace(/\s+/g, ' ').trim()
}

function firstDocumentImage(document: EditorialDocument) {
  const findImage = (node: EditorialNode): string | null => {
    if (node.type === 'editorialImage' && typeof node.attrs?.src === 'string') return node.attrs.src
    for (const child of node.content || []) {
      const image = findImage(child)
      if (image) return image
    }
    return null
  }

  for (const node of document.content || []) {
    const image = findImage(node)
    if (image) return image
  }
  return null
}

function truncateDescription(text: string, maxLength = 180) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trimEnd()}...`
}

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const list = await getPublishedList(slug)

  if (!list) {
    return {
      title: 'Lista não encontrada - Lophos',
      robots: { index: false, follow: false },
    }
  }

  const url = `${getSiteUrl()}/lists/${list.slug}`
  const socialTitle = list.seo_title || list.title
  const fallbackDescription = documentText(list.content_json) || 'Leia esta lista editorial no Lophos.'
  const description = truncateDescription(list.seo_description || fallbackDescription)
  const imageUrl = list.cover_image_url || firstDocumentImage(list.content_json)
  const images = imageUrl ? [{ url: imageUrl, alt: list.cover_image_alt || list.title }] : undefined

  return {
    title: `${socialTitle} - Lophos`,
    description,
    keywords: list.keywords,
    authors: [{ name: list.author_name }],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      siteName: 'Lophos',
      locale: 'pt_BR',
      title: socialTitle,
      description,
      publishedTime: list.published_at || undefined,
      modifiedTime: list.updated_at,
      authors: [list.author_name],
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: socialTitle,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default async function PublishedEditorialListPage({ params }: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const list = await getPublishedList(slug)
  if (!list) notFound()

  const topicLabel = list.topic.charAt(0).toLocaleUpperCase('pt-BR') + list.topic.slice(1)
  const publishedAt = list.published_at
    ? formatDistanceToNow(new Date(list.published_at), { addSuffix: true, locale: ptBR })
    : null
  const imageUrl = list.cover_image_url || firstDocumentImage(list.content_json)
  const description = truncateDescription(list.seo_description || documentText(list.content_json) || list.title)
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: list.title,
    description,
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: list.published_at,
    dateModified: list.updated_at,
    author: { '@type': 'Person', name: list.author_name },
    mainEntityOfPage: `${getSiteUrl()}/lists/${list.slug}`,
    keywords: [...list.keywords, ...list.matched_topics].join(', '),
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <main className="page-scroll">
        <article className="article-layout mx-auto mt-[10vh] animate-fade-in px-6 pb-24 md:pb-8">
          <span className="category-topic-pill">
            <TopicIcon topic={list.topic} />
            <span>{topicLabel}</span>
          </span>

          <h1 className="mb-3 mt-2 break-words text-4xl leading-tight text-ink-primary">{list.title}</h1>

          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Clock size={16} />
            {publishedAt ? <time dateTime={list.published_at || undefined}>Publicado {publishedAt}</time> : null}
            <span aria-hidden="true">·</span>
            {list.author_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={list.author_image_url} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : <span className="h-5 w-5 rounded-full bg-bg-tertiary" />}
            <span>Por {list.author_name}</span>
          </div>

          {list.cover_image_url ? (
            <figure className="mb-8">
              <ZoomableEditorialImage
                src={list.cover_image_url}
                alt={list.cover_image_alt || ''}
                credit={list.cover_image_credit || undefined}
                imageClassName="article-image h-auto w-full"
              />
            </figure>
          ) : null}

          <EditorialDocumentView document={list.content_json} />

          <EditorialListActions
            listId={list.id}
            slug={list.slug}
            title={list.title}
            text={documentText(list.content_json)}
          />
        </article>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
    </div>
  )
}
