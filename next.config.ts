import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: {
    // Skip type checking during build
    ignoreBuildErrors: true,
  },
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  webpack: (config) => {
    // tiny-secp256k1 ships a `.wasm` binary that needs WebAssembly enabled in webpack 5.
    config.experiments = { ...(config.experiments || {}), asyncWebAssembly: true };
    // Only treat the tiny-secp256k1 wasm as a WebAssembly module. Other deps (e.g. wasm-bindgen)
    // may reference `.wasm` via `new URL(..., import.meta.url)` and expect it to be emitted as an asset.
    config.module.rules.push({ test: /secp256k1\\.wasm$/, type: "webassembly/async" });
    return config;
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },

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
  ],
};

export default nextConfig;
