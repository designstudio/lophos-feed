import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://lophos.space'),
  title: 'Lophos Feed',
  description: 'Seu feed de noticias personalizado por IA.',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lophos',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <head>
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
                if (navigator.standalone === true) {
                  document.documentElement.classList.add('pwa-ios');
                }
              } catch(e) {}
            })();
          ` }} />
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          ` }} />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
