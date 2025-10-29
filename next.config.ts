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
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
