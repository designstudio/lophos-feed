export interface NewsSource {
  name: string
  url: string
  favicon?: string
}

export interface ArticleSection {
  heading: string
  body: string
}

export interface NewsItem {
  id: string
  topic: string
  title: string
  summary: string         // intro paragraph — used in feed cards
  sections?: ArticleSection[]  // structured sections — used in article page
  conclusion?: string     // "O que esperar" / "Próximos passos"
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
