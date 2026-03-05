import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '48mb', // Appwrite PDF bucket limit: 50,000,000 bytes ≈ 47.6 MiB
    },
  },
};

export default nextConfig;
