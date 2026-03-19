import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyFeed — Seu feed de notícias personalizado',
  description: 'Notícias dos seus temas favoritos, curadas por IA.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
