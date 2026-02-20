/* Base System — Creator Dashboard SW (folder-scoped, versioned)
   Fixes: stale dashboard.js after deploys

   Key points:
   - Works inside /creator-Dashboard/ (not repo root)
   - Versioned cache name injected by GitHub Actions (__BUILD_VERSION__)
   - skipWaiting + clients.claim for immediate takeover
   - Network-first for HTML + JS/CSS so code is never stale
*/

const BUILD_VERSION = "__BUILD_VERSION__"; // injected at deploy time
const SW_VERSION =
  BUILD_VERSION && BUILD_VERSION !== "__BUILD_VERSION__"
    ? BUILD_VERSION
    : "dev";

const CACHE_PREFIX = "base-creator-dashboard";
const CACHE_NAME = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;

// IMPORTANT: folder scope base path (ex: "/Base-Creator-Land/creator-Dashboard/")
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname.endsWith("/")
  ? SCOPE_URL.pathname
  : `${SCOPE_URL.pathname}/`;

// Minimal shell inside THIS folder (keep small to avoid stale)
const PRECACHE_URLS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}sw-register.js`,
  `${BASE_PATH}dashboard.js`
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: "reload" })));
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const dest = req.destination;
  const isNavigation = req.mode === "navigate" || dest === "document";

  // HTML navigations: network-first
  if (isNavigation) {
    event.respondWith(networkFirst(req, true));
    return;
  }

  // JS/CSS/Workers: network-first (prevents stale code)
  if (dest === "script" || dest === "style" || dest === "worker") {
    event.respondWith(networkFirst(req, false));
    return;
  }

  // Images/Fonts: cache-first
  if (dest === "image" || dest === "font") {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req, allowNavFallback) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;

    if (allowNavFallback && req.mode === "navigate") {
      const fallback = await cache.match(`${BASE_PATH}index.html`);
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}
