import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [".*"],
  typescript: {
    ignoreBuildErrors: true,
    jsx: "preserve",
    reactStrictMode: false,
    target: "es2022",
    lib: ["dom", "dom.iterable", "esnext"],
  },
};

export default nextConfig;
