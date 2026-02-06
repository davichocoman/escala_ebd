const CACHE_NAME = 'ad-rodovia-v3'; // Mudei a versão para forçar atualização
const OFFLINE_URL = '/static/offline.html'; // <-- Faltava isso!

const assets = [
  '/',
  '/login',
  '/static/portal.css',
  '/static/offline.html',
  '/static/logo.png',
  '/static/painel-secretaria.js',
  '/static/painel-pastor.js',
  '/static/painel-membro.js'
];

self.addEventListener('install', (event) => {
    // Força o Service Worker novo a assumir o controle na hora
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(assets))
    );
});

self.addEventListener('activate', (event) => {
    // Limpa caches antigos
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                          .map(name => caches.delete(name))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'Nova Atualização', body: 'Confira as novidades no painel.' };
    
    const options = {
        body: data.body,
        icon: '/static/icons/android/android-launchericon-192-192.png',
        badge: '/static/icons/android/android-launchericon-96-96.png',
        vibrate: [100, 50, 100],
        data: { url: '/secretaria' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Abre o app ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
