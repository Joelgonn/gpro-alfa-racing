// gpro-alfa-racing-brasil/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        // Trocamos 'localhost' por '127.0.0.1' para evitar erros de resolução de DNS no Windows
        destination: 'http://127.0.0.1:8000/api/python/:path*', 
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.gpro.net',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1', // Ajustado aqui também
        port: '8000',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;