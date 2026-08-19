import { FeedItem, NewsSource } from '@/lib/types'
import { getMatchingInterestTopicLabel } from '@/lib/default-interest-topics'

const LAZY_IMAGE_PATTERNS = ['lazyload', 'lazy-load', 'placeholder', 'blank.gif', 'spacer.gif', 'fallback.gif']

export type FeedArticleRow = {
  id: string
  topic: string
  title: string
  summary: string
  sources?: unknown
  image_url?: string | null
  published_at: string
  cached_at: string
  matched_topics?: unknown
  tavily_raw?: unknown
  coverage_images?: unknown
  coverage_image_0?: unknown
  coverage_image_1?: unknown
  coverage_image_2?: unknown
  coverage_image_3?: unknown
  coverage_image_4?: unknown
  coverage_image_5?: unknown
  coverage_image_6?: unknown
  coverage_image_7?: unknown
}

export const PERSONALIZED_FEED_SELECT = 'id,topic,title,summary,sources,image_url,published_at,cached_at,matched_topics,coverage_image_0:tavily_raw->0->>image,coverage_image_1:tavily_raw->1->>image,coverage_image_2:tavily_raw->2->>image,coverage_image_3:tavily_raw->3->>image,coverage_image_4:tavily_raw->4->>image,coverage_image_5:tavily_raw->5->>image,coverage_image_6:tavily_raw->6->>image,coverage_image_7:tavily_raw->7->>image' as const

function normalizeSources(value: unknown): NewsSource[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === 'object')
    .map((source) => ({
      name: typeof source.name === 'string' ? source.name : '',
      url: typeof source.url === 'string' ? source.url : '',
      ...(typeof source.favicon === 'string' && source.favicon ? { favicon: source.favicon } : {}),
    }))
}

function normalizeCoverageImages(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const images = value
    .filter((image): image is string => typeof image === 'string' && Boolean(image))
    .filter((image) => !LAZY_IMAGE_PATTERNS.some((pattern) => image.toLowerCase().includes(pattern)))
    .filter((image, index, allImages) => allImages.indexOf(image) === index)
    .slice(0, 4)

  return images.length > 0 ? images : undefined
}

function extractCoverageImages(row: FeedArticleRow): string[] | undefined {
  if (Object.prototype.hasOwnProperty.call(row, 'coverage_images')) {
    return normalizeCoverageImages(row.coverage_images)
  }

  if (Object.prototype.hasOwnProperty.call(row, 'coverage_image_0')) {
    return normalizeCoverageImages([
      row.coverage_image_0,
      row.coverage_image_1,
      row.coverage_image_2,
      row.coverage_image_3,
      row.coverage_image_4,
      row.coverage_image_5,
      row.coverage_image_6,
      row.coverage_image_7,
    ])
  }

  if (!Array.isArray(row.tavily_raw)) return undefined

  return normalizeCoverageImages(row.tavily_raw.map((result) => {
    if (!result || typeof result !== 'object') return null
    return (result as Record<string, unknown>).image
  }))
}

export function toFeedItem(row: FeedArticleRow, userTopics: string[] = []): FeedItem {
  const matchedTopics = Array.isArray(row.matched_topics)
    ? row.matched_topics.filter((topic): topic is string => typeof topic === 'string')
    : []
  const displayTopic = getMatchingInterestTopicLabel([row.topic, ...matchedTopics], userTopics) ?? row.topic
  const coverageImages = extractCoverageImages(row)

  return {
    id: row.id,
    topic: row.topic,
    displayTopic,
    title: row.title,
    summary: row.summary,
    sources: normalizeSources(row.sources),
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    ...(coverageImages ? { coverageImages } : {}),
    publishedAt: row.published_at,
    cachedAt: row.cached_at,
  }
}
