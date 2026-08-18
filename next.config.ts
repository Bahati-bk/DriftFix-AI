import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [".*"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
