/* =====================================================
   DreamTrawell Destinations – Service Worker
===================================================== */

const CACHE_NAME = "dtd-pwa-v1";

/* Pages that should work offline (APP SHELL) */
const APP_SHELL = [
  "/",
  "/dashboard",
  "/attendance",
  "/manifest.json"
];

/* =====================================================
   INSTALL
===================================================== */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
});

/* =====================================================
   ACTIVATE
===================================================== */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

/* =====================================================
   FETCH
===================================================== */
self.addEventListener("fetch", event => {
  const { request } = event;

  /* Only handle GET requests */
  if (request.method !== "GET") return;

  /* Ignore Firebase / APIs */
  if (
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("firebase") ||
    request.url.includes("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          /* Cache static assets only */
          if (
            request.url.includes("/icons/") ||
            request.url.endsWith(".css") ||
            request.url.endsWith(".js")
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match("/dashboard"));
    })
  );
});
