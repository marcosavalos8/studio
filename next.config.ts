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
      {
        // Cache API requests (Firestore, etc.)
        urlPattern: /^https:\/\/[a-z0-9-]+\.googleapis\.com\//i,
        handler: 'NetworkFirst' as const,
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
          networkTimeoutSeconds: 2, // Reduced timeout for faster offline fallback
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
