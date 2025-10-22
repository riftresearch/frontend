import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
      },
    ],
  },

  // Turbopack configuration
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Server external packages
  serverExternalPackages: [
    "pino-pretty",
    "lokijs",
    "encoding",
    "@uniswap/smart-order-router",
    "@uniswap/v3-sdk",
    "@uniswap/v4-sdk",
    "@uniswap/sdk-core",
  ],
};

export default nextConfig;
