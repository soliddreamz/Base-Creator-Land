const CACHE = "creator-dashboard-v1-2"; // bump version to break old cache
const ASSETS = [
  "./",
  "./index.html",
  "./dashboard.js",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first for HTML/JS so updates win.
// Cache-first for everything else.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  const isSameScope = url.pathname.includes("/creator-Dashboard/");
  if (!isSameScope) return;

  const isHtml = e.request.destination === "document" || url.pathname.endsWith("/creator-Dashboard/") || url.pathname.endsWith("/creator-Dashboard/index.html");
  const isJs = e.request.destination === "script" || url.pathname.endsWith(".js");

  if (isHtml || isJs) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        const hit = await caches.match(e.request);
        return hit || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
