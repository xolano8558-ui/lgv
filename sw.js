// Offline support. Every request tries the PC first, so a new build reaches the phone on the next
// open; the last good copy is kept and shown only when the PC cannot be reached.
// Hashed /assets/ files never change, so they are served from cache when present.
// Cached API data never leaves the phone.
const VERSION = 'v5'
const SHELL = 'longevity-shell-' + VERSION, API = 'longevity-api-' + VERSION
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png']))) })
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== API).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())))

// Cached answers are marked with x-offline so the app can say "đang xem dữ liệu cũ".
function markOffline(r) {
  const h = new Headers(r.headers); h.set('x-offline', '1')
  return r.blob().then((b) => new Response(b, { status: r.status, headers: h }))
}
function networkFirst(req, cacheName, offlineBody) {
  return fetch(req, { cache: 'no-store' }).then((r) => { if (r.ok) { const c = r.clone(); caches.open(cacheName).then((x) => x.put(req, c)) } return r })
    .catch(() => caches.match(req).then((r) => r ? (offlineBody ? markOffline(r) : r) : (offlineBody ? new Response(offlineBody, { status: 503 }) : caches.match('./'))))
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin) return
  if (u.pathname.includes('/api/')) {
    e.respondWith(networkFirst(e.request, API, JSON.stringify({ offline: true })))
  } else if (u.pathname.includes('/assets/')) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => { const c = resp.clone(); caches.open(SHELL).then((x) => x.put(e.request, c)); return resp })))
  } else {
    e.respondWith(networkFirst(e.request, SHELL))
  }
})
