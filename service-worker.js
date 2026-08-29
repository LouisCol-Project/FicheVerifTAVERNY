const CACHE_NAME = "cis-tav-v302";

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json"
];

/* =========================
   INSTALL
========================= */

self.addEventListener("install", (event) => {

  console.log("[SW] Installation :", CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
  );

  self.skipWaiting();

});


/* =========================
   ACTIVATE
========================= */

self.addEventListener("activate", (event) => {

  console.log("[SW] Activation :", CACHE_NAME);

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME) {

            console.log(
              "[SW] Suppression ancien cache :",
              key
            );

            return caches.delete(key);

          }

        })

      );

    })

  );

  self.clients.claim();

});


/* =========================
   FETCH
========================= */

self.addEventListener("fetch", (event) => {

  if (event.request.method !== "GET") {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);


  /* =========================
     PAGES HTML
     NETWORK FIRST
  ========================= */

  if (request.mode === "navigate") {

    event.respondWith(

      fetch(request, {
        cache: "no-store"
      })

      .then(response => {

        if (!response || response.status !== 200) {
          return response;
        }

        const clone = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(request, clone);
          });

        return response;

      })

      .catch(() => {

        return caches.match(request)
          .then(cached => {

            if (cached) {
              return cached;
            }

            return caches.match("./index.html");

          });

      })

    );

    return;
  }


  /* =========================
     JS / CSS / JSON
     NETWORK FIRST
  ========================= */

  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".json")
  ) {

    event.respondWith(

      fetch(request, {
        cache: "no-store"
      })

      .then(response => {

        if (!response || response.status !== 200) {
          return response;
        }

        const clone = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(request, clone);
          });

        return response;

      })

      .catch(() => {
        return caches.match(request);
      })

    );

    return;
  }


  /* =========================
     IMAGES / AUTRES
     CACHE FIRST
  ========================= */

  event.respondWith(

    caches.match(request)
      .then(cached => {

        if (cached) {
          return cached;
        }

        return fetch(request)
          .then(response => {

            if (
              !response ||
              response.status !== 200
            ) {
              return response;
            }

            const clone = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, clone);
              });

            return response;

          });

      })

  );

});