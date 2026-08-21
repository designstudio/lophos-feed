import type { Metadata } from 'next'
import { FeedPage } from '@/components/feed/FeedPage'

export const metadata: Metadata = {
  title: 'Lophos Feed',
  description: 'Notícias recentes e listas editoriais para acompanhar o que importa.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return <FeedPage />
}
