import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a small self-contained Next server for the packaged Electron app.
  output: "standalone",

  // Electron and browsers load via 127.0.0.1 or localhost.
  // Next.js 16 dev server checks allowedDevOrigins for HMR/WebSocket connections.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // Allow production build with Turbopack while supporting webpack watch configuration
  turbopack: {},

  // Configure webpack watch options to ensure instantaneous file detection
  // on Windows filesystem for child components and dynamically added pages.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 800,
        aggregateTimeout: 200,
      };
    }
    return config;
  },
};

export default nextConfig;
