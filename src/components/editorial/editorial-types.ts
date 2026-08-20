export type EditorialStatus = 'draft' | 'published' | 'archived'

export type EditorialDocument = {
  type: 'doc'
  content?: EditorialNode[]
}

export type EditorialMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type EditorialNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: EditorialNode[]
  marks?: EditorialMark[]
  text?: string
}

export type EditorialListRecord = {
  id: string
  slug: string
  title: string
  content_json: EditorialDocument
  cover_image_url: string | null
  cover_image_alt: string | null
  cover_image_credit: string | null
  topic: string
  matched_topics: string[]
  keywords: string[]
  seo_title: string | null
  seo_description: string | null
  status: EditorialStatus
  author_name: string
  author_image_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type EditorialDraft = {
  title: string
  slug: string
  contentJson: EditorialDocument
  coverImageUrl: string
  coverImageAlt: string
  coverImageCredit: string
  topic: string
  topics: string[]
  seoTags: string[]
  seoTitle: string
  seoDescription: string
  status: EditorialStatus
}

export type EditorialImageAttributes = {
  src: string
  alt: string
  credit: string
}

export const EMPTY_EDITORIAL_DOCUMENT: EditorialDocument = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}
