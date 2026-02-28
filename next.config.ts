import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["*.inc1.devtunnels.ms", "localhost:3000"],
    },
  },
};

export default nextConfig;
