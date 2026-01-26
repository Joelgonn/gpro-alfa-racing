import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removemos os rewrites porque agora a API é nativa (dentro do Next.js)
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.gpro.net',
      },
      // Removemos a referência ao 127.0.0.1:8000 aqui também
    ],
  },
};

export default nextConfig;