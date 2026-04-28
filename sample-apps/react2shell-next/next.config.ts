import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  turbopack: {
    root: __dirname, // Prevents issues with multiple package jsons
  },
};

export default nextConfig;
