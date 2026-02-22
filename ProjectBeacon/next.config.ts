import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid incorrect root inference when multiple lockfiles exist on the host.
    root: path.resolve(__dirname),
  },
  experimental: {
    // Work around Turbopack persistence-database startup failures.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
