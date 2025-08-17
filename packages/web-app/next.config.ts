/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable export output for SSG mode
  output: 'export',

  env: {
    API_BASE_URL: 'https://api.perf-mon.examples.oleksiipopov.com'
  },
  trailingSlash: false,
  images: {
    unoptimized: true,
  }
};

export default nextConfig;