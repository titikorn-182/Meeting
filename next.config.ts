import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate smoke-test servers so they cannot overwrite a running developer build.
  distDir: process.env.NEXT_DIST_DIR && /^\.next-[a-z0-9-]+$/.test(process.env.NEXT_DIST_DIR) ? process.env.NEXT_DIST_DIR : '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
