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
  topic: string          // tópico original do artigo (ex: "anime")
  displayTopic?: string  // tópico do usuário que fez o match (ex: "música")
  title: string
  summary: string         // intro paragraph — used in feed cards
  sections?: ArticleSection[]  // structured sections — used in article page
  conclusion?: string     // "O que esperar" / "Próximos passos"
  sources: NewsSource[]
  imageUrl?: string
  publishedAt: string
  cachedAt: string
  tavilyRaw?: { url: string; title: string; content: string; image?: string }[]  // original Tavily results
}

export interface UserTopic {
  id: string
  user_id: string
  topic: string
  created_at: string
}

export interface RawArticleRow {
  id: string
  topic: string
  tavily_results: {
    url: string
    title: string
    content: string
    image?: string
  }[]
  query?: string
  fetched_at: string
  status: 'raw' | 'processed' | 'dedup' | 'low_quality'
  created_at: string
}
