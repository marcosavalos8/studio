import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // sin experimental.trace
  typescript: {
    ignoreBuildErrors: true, // 👈 Ignora errores de tipos al compilar
  },
  eslint: {
    ignoreDuringBuilds: true, // 👈 Ignora errores de ESLint en el build
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
        // Cache pages with NetworkFirst strategy
        urlPattern: ({ request }: { request: Request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        // Cache API requests (Firestore, etc.)
        urlPattern: /^https:\/\/.*\.googleapis\.com\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
          networkTimeoutSeconds: 10,
        },
      },
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
