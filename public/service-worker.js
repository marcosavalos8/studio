const CACHE_NAME = "fieldtack-cache-v1";
const urlsToCache = [
  "/",
  "/dashboard",
  "/clients",
  "/employees",
  "/tasks",
  "/time-tracking",
  "/payroll",
  "/invoicing",
  "/offline",
  "/login",
  "/favicon.ico",
  "/logo.jpeg",
  "/manifest.json",
  // Recursos estáticos de Next.js
  "/_next/static/css/app/layout.css",
  "/_next/static/chunks/webpack.js",
  "/_next/static/chunks/main.js",
];

// Instalar SW y guardar archivos en caché
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Caching files");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("❌ Cache failed:", error);
      })
  );
  self.skipWaiting();
});

// Activar y limpiar versiones viejas
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activated");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🗑️ Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Interceptar peticiones (Cache First Strategy)
/* self.addEventListener("fetch", (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== "GET") return;

  // No cachear peticiones a Firebase
  if (
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("firebase")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en caché, devolverlo
      if (response) {
        console.log("📂 Serving from cache:", event.request.url);
        return response;
      }

      // Si no está en caché, intentar fetch
      return fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, cachearla
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla todo, mostrar página offline
          console.log("🔌 Offline - serving offline page");
          return caches.match("/offline");
        });
    })
  );
}); */

// Interceptar peticiones - SOLO para recursos estáticos
self.addEventListener("fetch", (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== "GET") return;

  // NO cachear peticiones a Firebase/API - déjalas fallar naturalmente
  if (
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("firebase") ||
    event.request.url.includes("/api/")
  ) {
    return; // Dejar que tu toast maneje estos errores
  }

  // Solo cachear navegación y recursos estáticos
  if (
    event.request.mode === "navigate" ||
    event.request.destination === "document" ||
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    event.request.destination === "image"
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          console.log("📂 Serving from cache:", event.request.url);
          return response;
        }

        // Intentar fetch, pero no fallar si no hay internet
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Solo para navegación, devolver una respuesta básica
            if (event.request.mode === "navigate") {
              return new Response(
                `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>FieldTack WA</title>
                      <meta charset="utf-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1">
                    </head>
                    <body>
                      <div id="__next"></div>
                      <script>
                        // Tu app manejará el estado offline con el toast
                        window.location.reload();
                      </script>
                    </body>
                  </html>
                `,
                {
                  headers: { "Content-Type": "text/html" },
                }
              );
            }
            // Para otros recursos, simplemente fallar
            throw error;
          });
      })
    );
  }
});
