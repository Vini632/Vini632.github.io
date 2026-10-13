const APP_PATH = new URL('./', self.registration.scope).pathname;
const CACHE_PREFIX = `worldforge-static:${encodeURIComponent(APP_PATH)}:`;
const CACHE = `${CACHE_PREFIX}v38`;
const FILES = ['./', './index.html', './styles.css?v=12', './landing.css?v=2', './animations.css', './theme-black.css?v=12', './world-validation.js?v=1', './community-validation.js?v=1', './cloud-config.js?v=6', './account-api.js?v=1', './app.js?v=37', './community.js?v=4', './world-catalog.js?v=1', './world-library.js?v=5', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE)
    .then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }))))
    .then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const remember = response => {
      if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
      return response;
    };
    if (event.request.mode === 'navigate') {
      try {
        return remember(await fetch(event.request, { cache: 'no-cache' }));
      } catch (error) {
        const cached = await cache.match(event.request) || await cache.match(new URL('index.html', self.registration.scope).href);
        if (cached) return cached;
        throw error;
      }
    }
    return await cache.match(event.request) || remember(await fetch(event.request));
  })());
});
