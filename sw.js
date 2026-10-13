const APP_PATH = new URL('./', self.registration.scope).pathname;
const CACHE_PREFIX = `worldforge-static:${encodeURIComponent(APP_PATH)}:`;
const CACHE = `${CACHE_PREFIX}v31`;
const FILES = ['./', './index.html', './styles.css?v=12', './animations.css', './theme-black.css?v=12', './world-validation.js?v=1', './community-validation.js?v=1', './cloud-config.js?v=4', './app.js?v=30', './community.js?v=2', './world-catalog.js?v=1', './world-library.js?v=3', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
