const CACHE_NAME = "fieldtack-cache-v2"; // Incrementar versión
const STATIC_CACHE = "fieldtack-static-v2";
const DYNAMIC_CACHE = "fieldtack-dynamic-v2";

// URLs críticas que SIEMPRE deben estar en caché
const CRITICAL_URLS = [
  "/",
  "/dashboard",
  "/clients",
  "/employees",
  "/tasks",
  "/time-tracking",
  "/payroll",
  "/invoicing",
  "/offline",
];

// Recursos estáticos
const STATIC_ASSETS = [
  "/favicon.ico",
  "/logo.jpeg",
  "/manifest.json",
  // Next.js assets se cachearán dinámicamente
];

// Instalar SW
self.addEventListener("install", (event) => {
  console.log("🔧 SW Installing...");

  event.waitUntil(
    Promise.all([
      // Cache crítico
      caches.open(CACHE_NAME).then((cache) => {
        console.log("📦 Caching critical pages");
        return cache.addAll(CRITICAL_URLS);
      }),
      // Cache estático
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("📦 Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      }),
    ]).catch((error) => {
      console.error("❌ Install failed:", error);
    })
  );

  // Forzar activación inmediata
  self.skipWaiting();
});

// Activar SW
self.addEventListener("activate", (event) => {
  console.log("🚀 SW Activated");

  event.waitUntil(
    Promise.all([
      // Limpiar cachés viejos
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (
              key !== CACHE_NAME &&
              key !== STATIC_CACHE &&
              key !== DYNAMIC_CACHE
            ) {
              console.log("🗑️ Deleting old cache:", key);
              return caches.delete(key);
            }
          })
        )
      ),
      // Tomar control inmediatamente
      self.clients.claim(),
    ])
  );
});

// Estrategia de fetch
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no son GET
  if (request.method !== "GET") return;

  // Ignorar Chrome extensions y otros protocolos
  if (!url.protocol.startsWith("http")) return;

  // Ignorar Firebase y APIs externas - dejar que fallen naturalmente
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Estrategia para navegación (páginas HTML)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Estrategia para recursos estáticos
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// Manejar navegación (páginas)
async function handleNavigationRequest(request) {
  try {
    // Intentar cache primero
    const cached = await caches.match(request);
    if (cached) {
      console.log("📂 Serving page from cache:", request.url);
      return cached;
    }

    // Si no está en cache, intentar red
    const response = await fetch(request);

    // Si la respuesta es válida, cachearla
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log("🔌 Navigation offline, serving from cache or offline page");

    // Intentar servir la página solicitada desde cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si no existe, intentar servir la página principal
    const mainPage = await caches.match("/");
    if (mainPage) return mainPage;

    // Último recurso: página offline
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;

    // Si nada funciona, crear respuesta mínima
    return new Response(
      `<!DOCTYPE html>
       <html>
         <head>
           <title>FieldTack WA - Offline</title>
           <meta charset="utf-8">
           <meta name="viewport" content="width=device-width, initial-scale=1">
         </head>
         <body>
           <div style="text-align:center; padding:50px;">
             <h1>You're Offline</h1>
             <p>Please check your internet connection</p>
             <button onclick="window.location.reload()">Retry</button>
           </div>
         </body>
       </html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

// Manejar recursos estáticos
async function handleStaticRequest(request) {
  try {
    // Cache First para recursos estáticos
    const cached = await caches.match(request);
    if (cached) {
      console.log("📂 Serving static from cache:", request.url);
      return cached;
    }

    // Intentar red
    const response = await fetch(request);

    // Cachear si es válido
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log("🔌 Static resource offline:", request.url);

    // Para JS/CSS críticos, intentar desde cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Si es una imagen, devolver placeholder
    if (request.destination === "image") {
      return new Response(
        '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image Offline</text></svg>',
        { headers: { "Content-Type": "image/svg+xml" } }
      );
    }

    throw error;
  }
}

// Manejar actualizaciones
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
