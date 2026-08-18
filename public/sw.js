/* =====================================================
   Dream Trawell CRM – lightweight service worker
   Keep navigation fresh and cache only small brand/PWA assets.
===================================================== */

const CACHE_NAME = "dreamtrawell-crm-v2.7.0";
const APP_SHELL = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/favicon.ico",
  "/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => (key === CACHE_NAME ? null : caches.delete(key)))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Do not intercept third-party, Firebase or API traffic.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Always prefer the latest HTML/navigation response. Use the dashboard shell
  // only when the user is offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match(request)) || caches.match("/dashboard");
      })
    );
    return;
  }

  const isBrandAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname.startsWith("/favicon-") ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/logo.png" ||
    url.pathname === "/manifest.json";

  if (!isBrandAsset) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
