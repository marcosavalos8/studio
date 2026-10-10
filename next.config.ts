import withPWA from "@ducanh2912/next-pwa";

// Unique identifier for each build. On Vercel every deploy gets a fresh
// VERCEL_GIT_COMMIT_SHA; locally/other hosts fall back to a build timestamp.
const buildVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.BUILD_VERSION ||
  String(Date.now());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Exposed to both server (/api/version) and client bundle (update prompt)
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
  // sin experimental.trace
  typescript: {
    ignoreBuildErrors: true, // 👈 Ignora errores de tipos al compilar
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  fallbacks: {
    // Fallback for pages when offline and not in cache
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    // Configure runtime caching strategies
    runtimeCaching: [
      {
        // Cache pages with NetworkFirst strategy, fallback to cache on offline
        urlPattern: ({ request }: any) => request.destination === 'document',
        handler: 'NetworkFirst' as const,
        options: {
          cacheName: 'pages-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          networkTimeoutSeconds: 1, // Reduced timeout for faster offline fallback
        },
      },
      // NOTE: there used to be a NetworkFirst/2s-timeout rule here caching
      // *.googleapis.com (Firestore, Auth, etc). Firestore's real-time
      // "Listen" stream is designed to stay open far longer than 2 seconds
      // waiting for server changes — Workbox treating that as "slow
      // network" and falling back to a (likely empty/stale) cached response
      // instead of passing the connection through is a known Firebase +
      // Workbox anti-pattern, and the best explanation found for clients/
      // ranches silently going empty after a long session. The hand-written
      // service worker (public/service-worker.js) already explicitly
      // passes through any googleapis.com/firebase/api request untouched —
      // this removal just makes the next-pwa-generated worker do the same,
      // regardless of which of the two ends up controlling the page.
      {
        // Cache static assets
        urlPattern: /\.(?:js|css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
})(nextConfig);
