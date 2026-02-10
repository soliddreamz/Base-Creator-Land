// Base Fan App Service Worker — V1 (CORRECT)
//
// Rules:
// 1. Cache app shell (HTML / static files)
// 2. NEVER cache content.json (dynamic creator state)

const CACHE_NAME = 'base-fan-shell-v1';
const SHELL_FILES = [
  './',
  './index.html'
];

// Install: cache shell only
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))
      )
    )
  );
  self.clients.claim();
});

// Fetch handling
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only same-origin requests
  if (url.origin !== self.location.origin) return;

  // 🚫 HARD RULE: content.json is NEVER cached
  if (url.pathname.endsWith('/content.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() =>
          new Response('{}', {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          })
        )
    );
    return;
  }

  // Cache-first for shell files
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (
          event.request.method === 'GET' &&
          response.ok &&
          response.type === 'basic'
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
