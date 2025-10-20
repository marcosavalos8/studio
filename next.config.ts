/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Disable trace in development to avoid permission issues
  experimental: {
    trace: process.env.NODE_ENV === "production",
  },
};

module.exports = nextConfig;
