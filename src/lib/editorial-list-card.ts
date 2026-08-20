import type { EditorialDocument, EditorialNode } from '@/components/editorial/editorial-types'

export type EditorialListCardItem = {
  id: string
  slug: string
  title: string
  cover_image_url: string | null
  cover_image_alt: string | null
  topic: string
  matched_topics: string[]
  seo_description: string | null
  author_name: string
  author_image_url: string | null
  published_at: string
  gallery_images: string[]
}

export const EDITORIAL_LIST_CARD_SELECT = [
  'id', 'slug', 'title', 'cover_image_url', 'cover_image_alt', 'topic', 'matched_topics',
  'seo_description', 'author_name', 'author_image_url', 'published_at', 'content_json',
].join(',')

export function editorialDocumentImages(document: EditorialDocument | null | undefined) {
  const images: string[] = []
  const visit = (node: EditorialNode) => {
    if (node.type === 'editorialImage' && typeof node.attrs?.src === 'string') images.push(node.attrs.src)
    node.content?.forEach(visit)
  }
  document?.content?.forEach(visit)
  return images
}

export function toEditorialListCardItem(row: Record<string, any>): EditorialListCardItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    cover_image_url: row.cover_image_url ?? null,
    cover_image_alt: row.cover_image_alt ?? null,
    topic: row.topic,
    matched_topics: Array.isArray(row.matched_topics) ? row.matched_topics : [],
    seo_description: row.seo_description ?? null,
    author_name: row.author_name,
    author_image_url: row.author_image_url ?? null,
    published_at: row.published_at,
    gallery_images: [...new Set([
      ...(row.cover_image_url ? [row.cover_image_url] : []),
      ...editorialDocumentImages(row.content_json as EditorialDocument),
    ])].slice(0, 8),
  }
}
