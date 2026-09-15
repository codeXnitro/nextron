import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Creates a small self-contained Next server for the packaged Electron app.
  output: "standalone",
};

export default nextConfig;
