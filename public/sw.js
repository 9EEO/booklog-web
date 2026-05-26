const CACHE_NAME = 'booklog-timer-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg']
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '0.0.0.0'].includes(self.location.hostname)

self.addEventListener('install', (event) => {
  if (IS_LOCAL_DEV) {
    self.skipWaiting()
    return
  }

  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.registration.unregister()))
    self.clients.claim()
    return
  }

  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (IS_LOCAL_DEV) return
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
    }),
  )
})
