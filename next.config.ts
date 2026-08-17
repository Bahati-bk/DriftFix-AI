import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
    jsx: "preserve",
    reactStrictMode: false,
    target: "es2022",
    lib: ["dom", "dom.iterable", "esnext"],
  },
};

export default nextConfig;
