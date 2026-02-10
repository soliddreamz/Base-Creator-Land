self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('base-fan').then(cache =>
      cache.addAll([
        './',
        './index.html',
        './content.json'
      ])
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
