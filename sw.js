const APP_PATH = new URL('./', self.registration.scope).pathname;
const CACHE_PREFIX = `worldforge-static:${encodeURIComponent(APP_PATH)}:`;
const CACHE = `${CACHE_PREFIX}v49`;
const FILES = ['./', './index.html', './styles.css?v=16', './landing.css?v=2', './animations.css', './theme-black.css?v=13', './character-sheet.css?v=1', './character-sheet.js?v=1', './world-validation.js?v=2', './community-validation.js?v=1', './cloud-config.js?v=7', './account-api.js?v=3', './auth-bundle.js?v=2', './auth-ui.css?v=2', './account-workspace.js?v=2', './app.js?v=45', './community.js?v=5', './world-catalog.js?v=2', './world-library.js?v=5', './manifest.webmanifest', './assets/icon.svg', './bot/admin/botp/', './bot/admin/botp/index.html', './bot/admin/botp/request-id.js?v=1', './bot/admin/botp/panel.js?v=4', './bot/admin/botp/panel.css?v=3'];
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
        const fallback = new URL(event.request.url).pathname.startsWith(APP_PATH+'bot/admin/botp/') ? 'bot/admin/botp/index.html' : 'index.html';
        const cached = await cache.match(event.request) || await cache.match(new URL(fallback, self.registration.scope).href);
        if (cached) return cached;
        throw error;
      }
    }
    return await cache.match(event.request) || remember(await fetch(event.request));
  })());
});
