/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Lambda deployment
  output: 'standalone',
  // Enable ISR
  trailingSlash: false,
  // API configuration
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'https://perf-mon.examples.oleksiipopov.com'
  }
}

module.exports = nextConfig