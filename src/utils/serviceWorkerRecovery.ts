const isJavaScriptResponse = (response: Response) => {
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('javascript') || contentType.includes('ecmascript')
}

export const clearServiceWorkerCaches = async () => {
  if (!('caches' in window)) return

  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
}

export const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return false

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  return registrations.length > 0
}

export const recoverFromBrokenServiceWorker = async () => {
  const hadServiceWorker = await unregisterServiceWorkers()
  await clearServiceWorkerCaches()

  if (hadServiceWorker) {
    window.location.reload()
  }
}

export const ensureServiceWorkerIsHealthy = async () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  try {
    const response = await fetch('/sw.js', { cache: 'no-store' })

    if (!response.ok || !isJavaScriptResponse(response)) {
      await recoverFromBrokenServiceWorker()
    }
  } catch {
    // Network errors should not block app startup.
  }
}

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
