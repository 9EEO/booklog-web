const CACHE_NAME = 'booklog-timer-v3'
const STATIC_ASSETS = ['/favicon.svg', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png']
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '0.0.0.0'].includes(self.location.hostname)

const isStaticAsset = (pathname) => STATIC_ASSETS.includes(pathname)
const isHashedAsset = (pathname) => pathname.startsWith('/assets/')

const networkFirst = async (request) => {
  try {
    const response = await fetch(request)

    if (!response.ok) {
      const cached = await caches.match(request)
      return cached ?? response
    }

    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('Network unavailable')
  }
}

const cacheFirst = async (request) => {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
  }

  return response
}

self.addEventListener('install', (event) => {
  if (IS_LOCAL_DEV) {
    self.skipWaiting()
    return
  }

  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.registration.unregister()),
    )
    self.clients.claim()
    return
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_DEV) return
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate' || event.request.destination === 'document' || url.pathname === '/') {
    event.respondWith(networkFirst(event.request))
    return
  }

  if (isHashedAsset(url.pathname)) {
    event.respondWith(networkFirst(event.request))
    return
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request))
  }
})
