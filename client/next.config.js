/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
    // This allows images to be served from the same domain as the app
    // You should add your Azure Web App domain here when deployed
  },
  // This is important for handling image uploads and real-time functionality
  // in development mode
  webpack: (config) => {
    config.externals = [...config.externals, 'socket.io-client'];
    return config;
  },
};

module.exports = nextConfig; 