import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  serverExternalPackages: ['pino', 'pino-pretty', 'postgres'],
};

export default nextConfig;
