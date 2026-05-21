const CACHE_NAME = "cis-taverny-pro-v5";

// =========================
// FICHIERS OFFLINE
// =========================

const CORE_ASSETS = [

  "/",
  "/index.html",
  "/manifest.json",
  "/images/logo.png",

  // CSS / pages importantes
  "/VSAV.html",
  "/FPT.html",
  "/CCF.html",
  "/VSR.html",
  "/VTU.html",
  "/Historique.html",
  "/Stats.html"

];

// =========================
// INSTALL
// =========================

self.addEventListener("install", (event) => {

  self.skipWaiting();

  event.waitUntil(

    caches
      .open(CACHE_NAME)
      .then((cache) => {

        return cache.addAll(CORE_ASSETS);

      })

  );

});

// =========================
// ACTIVATE
// =========================

self.addEventListener("activate", (event) => {

  event.waitUntil(

    caches.keys().then((keys) => {

      return Promise.all(

        keys.map((key) => {

          if (key !== CACHE_NAME) {

            return caches.delete(key);

          }

        })

      );

    })

  );

  return self.clients.claim();

});

// =========================
// FETCH
// =========================

self.addEventListener("fetch", (event) => {

  const request = event.request;

  // ❌ Ignore Firebase / extensions
  if (

    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("googleapis.com") ||
    request.url.includes("chrome-extension")

  ) {

    return;

  }

  // =========================
  // HTML = Network First
  // =========================

  if (request.mode === "navigate") {

    event.respondWith(

      fetch(request)

        .then((networkResponse) => {

          const responseClone =
            networkResponse.clone();

          caches.open(CACHE_NAME)

            .then((cache) => {

              cache.put(request, responseClone);

            });

          return networkResponse;

        })

        .catch(() => {

          return caches.match(request)
            .then((response) => {

              return response ||
                caches.match("/index.html");

            });

        })

    );

    return;

  }

  // =========================
  // STATIC FILES
  // =========================

  event.respondWith(

    caches.match(request)

      .then((cachedResponse) => {

        if (cachedResponse) {

          // update arrière-plan
          fetch(request)

            .then((networkResponse) => {

              caches.open(CACHE_NAME)

                .then((cache) => {

                  cache.put(
                    request,
                    networkResponse.clone()
                  );

                });

            })

            .catch(() => {});

          return cachedResponse;

        }

        // sinon réseau
        return fetch(request)

          .then((networkResponse) => {

            const responseClone =
              networkResponse.clone();

            caches.open(CACHE_NAME)

              .then((cache) => {

                cache.put(
                  request,
                  responseClone
                );

              });

            return networkResponse;

          })

          .catch(() => {

            // fallback image
            if (
              request.destination === "image"
            ) {

              return caches.match(
                "/images/logo.png"
              );

            }

          });

      })

  );

});