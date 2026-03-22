const CACHE = 'lophos-v1'
const PRECACHE = ['/feed', '/site.webmanifest', '/apple-touch-icon.png']

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
  const url = new URL(e.request.url)

  // Sempre network-first para APIs e auth
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }

  // Cache-first para assets estáticos
  if (e.request.destination === 'image' || e.request.destination === 'style' || e.request.destination === 'script') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Network-first para páginas (com fallback para /feed)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request) || caches.match('/feed'))
  )
})
