const CACHE_NAME = 'ad-rodovia-v2';
const assets = [
  '/',
  '/static/portal.css',
  '/static/painel-secretaria.js',
  '/static/painel-pastor.js',
  '/static/painel-membro.js',
  '/static/script.js',
  '/static/icons/icon-192.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(assets))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Retorna o arquivo do cache ou tenta buscar na rede
            return response || fetch(event.request).catch(() => {
                // Se a rede falhar e for uma navegação de página, mostra a página offline
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});
