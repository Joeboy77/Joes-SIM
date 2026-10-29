import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@joes-sim/engine", "@joes-sim/ui"],
  reactStrictMode: true,
};

export default nextConfig;
