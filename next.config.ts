import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a self-contained Next server for the packaged Electron desktop app.
  output: "standalone",

  // Electron and browsers load via 127.0.0.1 or localhost.
  // Next.js 16 dev server checks allowedDevOrigins for HMR/WebSocket connections.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Turbopack configuration
  turbopack: {},

  // Configure webpack watch options and client-side fallbacks
  // Ensures seamless client/server isomorphic database usage without bundling issues.
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 800,
        aggregateTimeout: 200,
      };
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        events: false,
        child_process: false,
        net: false,
      };
    }

    return config;
  },
};

export default nextConfig;
