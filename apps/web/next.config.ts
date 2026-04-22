import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
  serverExternalPackages: ['pino', 'pino-pretty', 'postgres'],
};

export default nextConfig;
