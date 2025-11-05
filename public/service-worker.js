const CACHE_VERSION = "v3";
const APP_SHELL_CACHE = `fieldtack-app-shell-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `fieldtack-dynamic-${CACHE_VERSION}`;
const STATIC_CACHE = `fieldtack-static-${CACHE_VERSION}`;

// 🎯 APP SHELL - URLs críticas que SIEMPRE deben estar en caché
const APP_SHELL_URLS = [
  // Páginas principales
  "/",
  "/dashboard",
  "/employees",
  "/clients",
  "/tasks",
  "/time-tracking",
  "/payroll",
  "/invoicing",
  "/login",
  "/offline",

  // Rutas de API Next.js que pueden necesitarse
  "/_next/static/css/app/layout.css",

  // Recursos estáticos críticos
  "/favicon.ico",
  "/logo.jpeg",
  "/manifest.json",
];

// 📦 Recursos estáticos adicionales
const STATIC_RESOURCES = [
  // Iconos y recursos de UI
  "/icon-192x192.png",
  "/icon-512x512.png",
  // Agregar aquí otros recursos estáticos que uses
];

// 🚀 INSTALAR SERVICE WORKER - Pre-cache del App Shell
self.addEventListener("install", (event) => {
  console.log("🔧 SW Installing - Pre-caching App Shell...");

  event.waitUntil(
    Promise.all([
      // Cache crítico del App Shell
      caches.open(APP_SHELL_CACHE).then((cache) => {
        console.log("📦 Pre-caching App Shell URLs:", APP_SHELL_URLS);
        return cache.addAll(APP_SHELL_URLS).catch((error) => {
          console.error("❌ Failed to cache some App Shell URLs:", error);
          // Intentar cachear uno por uno para identificar cuáles fallan
          return Promise.allSettled(
            APP_SHELL_URLS.map((url) => cache.add(url))
          ).then((results) => {
            results.forEach((result, index) => {
              if (result.status === "rejected") {
                console.warn(
                  `⚠️ Failed to cache: ${APP_SHELL_URLS[index]}`,
                  result.reason
                );
              }
            });
          });
        });
      }),

      // Cache de recursos estáticos
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("📦 Caching static resources");
        return cache.addAll(STATIC_RESOURCES).catch((error) => {
          console.warn("⚠️ Some static resources failed to cache:", error);
        });
      }),
    ])
  );

  // Forzar activación inmediata
  self.skipWaiting();
});

// 🚀 ACTIVAR SERVICE WORKER
self.addEventListener("activate", (event) => {
  console.log("🚀 SW Activated - Cleaning old caches...");

  event.waitUntil(
    Promise.all([
      // Limpiar cachés viejos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== APP_SHELL_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== STATIC_CACHE
            ) {
              console.log("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),

      // Tomar control de todos los clientes inmediatamente
      self.clients.claim(),
    ])
  );
});

// 🌐 ESTRATEGIA DE FETCH
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests GET
  if (request.method !== "GET") return;

  // Ignorar protocolos no HTTP
  if (!url.protocol.startsWith("http")) return;

  // 🔥 NO interferir con Firebase/APIs - dejar que fallen naturalmente
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("_next/webpack-hmr")
  ) {
    return;
  }

  // 📄 NAVEGACIÓN (páginas HTML) - App Shell First
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 📦 RECURSOS ESTÁTICOS - Cache First
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(handleStaticAssets(request));
    return;
  }
});

// 🏠 Manejar navegación con App Shell Strategy
async function handleNavigation(request) {
  const url = new URL(request.url);

  try {
    // 1. Intentar App Shell cache primero
    const appShellResponse = await caches.match(request, {
      cacheName: APP_SHELL_CACHE,
    });

    if (appShellResponse) {
      console.log("🏠 Serving from App Shell cache:", url.pathname);
      return appShellResponse;
    }

    // 2. Intentar cache dinámico
    const dynamicResponse = await caches.match(request, {
      cacheName: DYNAMIC_CACHE,
    });

    if (dynamicResponse) {
      console.log("📂 Serving from dynamic cache:", url.pathname);
      return dynamicResponse;
    }

    // 3. Intentar red y cachear en dinámico
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("🔌 Navigation offline:", url.pathname);

    // Fallback: servir página principal desde App Shell
    const fallbackResponse = await caches.match("/", {
      cacheName: APP_SHELL_CACHE,
    });

    if (fallbackResponse) {
      console.log("🏠 Serving main page as fallback");
      return fallbackResponse;
    }

    // Último recurso: página offline
    const offlineResponse = await caches.match("/offline");
    if (offlineResponse) return offlineResponse;

    // Crear respuesta mínima
    return new Response(createOfflineHTML(), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

// 📦 Manejar recursos estáticos
async function handleStaticAssets(request) {
  try {
    // Cache First Strategy
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log("📦 Serving static from cache:", request.url);
      return cachedResponse;
    }

    // Intentar red y cachear
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("🔌 Static asset offline:", request.url);

    // Para imágenes, devolver placeholder
    if (request.destination === "image") {
      return new Response(
        `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f3f4f6"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="sans-serif">
            Image Offline
          </text>
        </svg>`,
        { headers: { "Content-Type": "image/svg+xml" } }
      );
    }

    throw error;
  }
}

// 📄 Crear HTML offline mínimo
function createOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>FieldTack WA - Offline</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            padding: 2rem;
            background: #f8fafc;
          }
          .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔌 You're Offline</h1>
          <p>No internet connection detected.</p>
          <p>Some features may be limited.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </div>
      </body>
    </html>
  `;
}

// 📱 Manejar mensajes
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_CACHE_STATUS") {
    event.ports[0].postMessage({
      appShellCached: true,
      version: CACHE_VERSION,
    });
  }
});
