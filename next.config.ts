import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a small self-contained Next server for the packaged Electron app.
  output: "standalone",

  // Electron loads the dev server via 127.0.0.1 (not localhost).
  // Next.js 16 blocks cross-origin HMR/WebSocket requests by default, which
  // breaks React hydration and live-reload inside the Electron window.
  // Adding 127.0.0.1 here restores full hot-reload and client interactivity.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
