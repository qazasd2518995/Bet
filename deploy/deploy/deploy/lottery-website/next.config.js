/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Optimize for production
  reactStrictMode: true,
  // Ensure consistent builds
  output: 'standalone',
  generateBuildId: async () => {
    // Use a timestamp-based build ID for consistency
    return Date.now().toString();
  },
  // Disable image optimization for Render deployment
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig 