export interface NewsItem {
  topic: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt?: string
  imageUrl?: string
}

export interface FeedResponse {
  items: NewsItem[]
  error?: string
}
