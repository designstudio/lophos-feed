import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lophos Feed',
  description: 'Seu feed de notícias personalizado por IA.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
    other: [
      { rel: 'manifest', url: '/site.webmanifest' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <head>
          {/* Blocking script — applies theme+accent before first paint, eliminates flash */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                var t = localStorage.getItem('theme') || 'light';
                var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (dark) document.documentElement.classList.add('dark');
                var accent = localStorage.getItem('accent_color');
                if (accent) document.documentElement.style.setProperty('--color-accent', accent);
                var sc = localStorage.getItem('sidebar_collapsed');
                var isCollapsed = sc === 'true';
                document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '3.5rem' : '16.1rem');
              } catch(e) {}
            })();
          ` }} />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
