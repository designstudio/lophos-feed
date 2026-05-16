const CACHE = 'lophos-static-v2'
const PRECACHE = ['/site.webmanifest', '/apple-touch-icon.png', '/favicon-32x32.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') {
    return
  }

  const url = new URL(e.request.url)

  // Never intercept authenticated APIs or dynamic App Router documents.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    e.request.mode === 'navigate' ||
    e.request.destination === 'document'
  ) {
    return
  }

  // Cache-first only for stable static assets.
  if (e.request.destination === 'image' || e.request.destination === 'style' || e.request.destination === 'script') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
  }
})
