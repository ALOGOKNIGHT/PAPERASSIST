const CACHE_PREFIX = 'papercraft-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-v1`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-v1`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/data/supabase-config.js',
  '/data/question-bank.js',
  '/icons/papercraft-192.png',
  '/icons/papercraft-512.png',
  '/icons/papercraft-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put('/index.html', response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/index.html'))));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const update = fetch(request).then(response => {
      if (response.ok) caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    });
    return cached || update;
  }));
});
