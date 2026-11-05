const PREFIX = "worldforge-english:" + self.registration.scope + ":";
const CACHE = PREFIX + "mw2u0rhd";
const ASSETS = ["./.nojekyll","./index.html","./public/favicon.svg","./public/icon-192.png","./public/icon-512.png","./public/manifest.webmanifest","./src/app.js","./src/cloud.js","./src/design.js","./src/math.js","./src/model.js","./src/storage.js","./src/style.css","./vendor/katex/fonts/KaTeX_AMS-Regular.ttf","./vendor/katex/fonts/KaTeX_AMS-Regular.woff","./vendor/katex/fonts/KaTeX_AMS-Regular.woff2","./vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf","./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff","./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2","./vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf","./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff","./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2","./vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf","./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff","./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2","./vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf","./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff","./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2","./vendor/katex/fonts/KaTeX_Main-Bold.ttf","./vendor/katex/fonts/KaTeX_Main-Bold.woff","./vendor/katex/fonts/KaTeX_Main-Bold.woff2","./vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf","./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff","./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2","./vendor/katex/fonts/KaTeX_Main-Italic.ttf","./vendor/katex/fonts/KaTeX_Main-Italic.woff","./vendor/katex/fonts/KaTeX_Main-Italic.woff2","./vendor/katex/fonts/KaTeX_Main-Regular.ttf","./vendor/katex/fonts/KaTeX_Main-Regular.woff","./vendor/katex/fonts/KaTeX_Main-Regular.woff2","./vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf","./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff","./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2","./vendor/katex/fonts/KaTeX_Math-Italic.ttf","./vendor/katex/fonts/KaTeX_Math-Italic.woff","./vendor/katex/fonts/KaTeX_Math-Italic.woff2","./vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf","./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff","./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2","./vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf","./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff","./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2","./vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf","./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff","./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2","./vendor/katex/fonts/KaTeX_Script-Regular.ttf","./vendor/katex/fonts/KaTeX_Script-Regular.woff","./vendor/katex/fonts/KaTeX_Script-Regular.woff2","./vendor/katex/fonts/KaTeX_Size1-Regular.ttf","./vendor/katex/fonts/KaTeX_Size1-Regular.woff","./vendor/katex/fonts/KaTeX_Size1-Regular.woff2","./vendor/katex/fonts/KaTeX_Size2-Regular.ttf","./vendor/katex/fonts/KaTeX_Size2-Regular.woff","./vendor/katex/fonts/KaTeX_Size2-Regular.woff2","./vendor/katex/fonts/KaTeX_Size3-Regular.ttf","./vendor/katex/fonts/KaTeX_Size3-Regular.woff","./vendor/katex/fonts/KaTeX_Size3-Regular.woff2","./vendor/katex/fonts/KaTeX_Size4-Regular.ttf","./vendor/katex/fonts/KaTeX_Size4-Regular.woff","./vendor/katex/fonts/KaTeX_Size4-Regular.woff2","./vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf","./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff","./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2","./vendor/katex/katex.min.css","./vendor/katex/katex.min.js","./vendor/katex/LICENSE","./vendor/supabase/LICENSE","./vendor/supabase/supabase.js"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await caches.match(
                new URL("./index.html", self.registration.scope),
              )
            : null) ||
          new Response("Indisponível offline", { status: 503 }),
      ),
  );
});
