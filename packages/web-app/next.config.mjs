/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Optimize for Lambda
  compress: false, // CloudFront will handle compression
  
  // Configure for server-side runtime
  experimental: {
    // Reduce bundle size
    optimizeCss: true,
  },
  
  // Image optimization
  images: {
    domains: ['perf-mon.examples.oleksiipopov.com'],
    unoptimized: true, // Lambda doesn't support Next.js image optimization
  },
  
  // Environment variables
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'https://perf-mon.examples.oleksiipopov.com',
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;