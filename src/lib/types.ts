export interface NewsSource {
  name: string
  url: string
  favicon?: string
}

export interface NewsItem {
  id: string
  topic: string
  title: string
  summary: string
  sources: NewsSource[]
  imageUrl?: string
  publishedAt: string
  cachedAt: string
}

export interface UserTopic {
  id: string
  user_id: string
  topic: string
  created_at: string
}
