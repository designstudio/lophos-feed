import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-outfit',
  fallback: ['system-ui', 'sans-serif'],
})

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
  const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true'

  return (
    <ClerkProvider>
      <html lang="pt-BR" className={outfit.variable} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                var t = localStorage.getItem('theme') || 'light';
                var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (dark) document.documentElement.classList.add('dark');
                if (navigator.standalone === true) {
                  document.documentElement.classList.add('pwa-ios');
                }
              } catch(e) {}
            })();
          ` }} />
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                var isLocalhost =
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1' ||
                  location.hostname === '[::1]';
                var enablePwa = ${JSON.stringify(enablePwa)};
                var cleanupKey = 'lophos:pwa-cleanup:v1';

                if (isLocalhost || !enablePwa) {
                  try {
                    if (localStorage.getItem(cleanupKey) === 'done') return;
                  } catch(e) {}

                  var registrationsCleanup = navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    return Promise.all(registrations.map(function(registration) { return registration.unregister(); }));
                  });
                  var cachesCleanup = 'caches' in window
                    ? caches.keys().then(function(keys) {
                        return Promise.all(keys.map(function(key) { return caches.delete(key); }));
                      })
                    : Promise.resolve();

                  Promise.all([registrationsCleanup, cachesCleanup]).then(function() {
                    try { localStorage.setItem(cleanupKey, 'done'); } catch(e) {}
                  }).catch(function() {});

                  return;
                }

                try { localStorage.removeItem(cleanupKey); } catch(e) {}
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
