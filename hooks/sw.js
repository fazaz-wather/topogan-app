
const CACHE_NAME = 'topogan-v4';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/vite.svg',
  '/manifest.json'
];

// Installe le service worker et met en cache les ressources de base
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Active le service worker et supprime les anciens caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Sert le contenu mis en cache en cas de déconnexion, sinon récupère sur le réseau
self.addEventListener('fetch', event => {
  // Nous ne nous intéressons qu'aux requêtes GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return fetch(event.request)
        .then(networkResponse => {
          // Si nous avons une réponse valide, la mettre en cache et la retourner
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Si la requête réseau échoue, essayer de servir depuis le cache
          return cache.match(event.request);
        });
    })
  );
});
