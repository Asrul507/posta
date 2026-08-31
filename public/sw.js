const CACHE_NAME = 'posta-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/db.js',
  '/js/state.js',
  '/js/loader.js',
  '/js/navigation.js',
  '/js/audio.js',
  '/js/scanner.js',
  '/js/views/auth.js',
  '/js/views/pos.js',
  '/js/views/checkout.js',
  '/js/views/products.js',
  '/js/views/shifts.js',
  '/js/views/po.js',
  '/js/views/reports.js',
  '/js/views/admin.js',
  '/components/header.html',
  '/components/sidebar.html',
  '/components/login.html',
  '/components/modals.html',
  '/components/view-pos.html',
  '/components/view-products.html',
  '/components/view-history.html',
  '/components/view-reports.html',
  '/components/view-admin.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('Cache addAll warning:', err))
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
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
