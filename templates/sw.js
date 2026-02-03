const CACHE_NAME = 'ad-rodovia-v1';
const assets = [
  '/',
  '/static/portal.css',
  '/static/painel-secretaria.js',
  '/static/icons/icon-192.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(res => {
      return res || fetch(evt.request);
    })
  );
});
