import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // App is a client-side SPA; static export emits ./out
};

export default nextConfig;
