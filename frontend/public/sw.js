// AgriBridge Service Worker for offline resilience
const CACHE_NAME = 'agribridge-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Never intercept Vite internal modules, HMR, or local dev requests
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('node_modules') ||
    url.search.includes('v=') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    /^10\./.test(url.hostname) ||
    /^192\.168\./.test(url.hostname)
  ) {
    return;
  }

  // Network first with fallback to cache for offline availability
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
