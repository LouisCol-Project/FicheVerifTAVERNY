const CACHE_NAME = "cis-taverny-pro-v3";

// fichiers essentiels
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./images/logo.png"
];

// =========================
// INSTALL (cache minimal)
// =========================
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// =========================
// ACTIVATE (nettoyage total ancien cache)
// =========================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  // prend immédiatement le contrôle
  return self.clients.claim();
});

// =========================
// FETCH STRATEGY HYBRIDE PRO
// =========================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 👉 HTML = toujours réseau (IMPORTANT)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 👉 fichiers statiques = cache + update
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});