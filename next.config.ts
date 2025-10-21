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

module.exports = nextConfig;
