import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@joes-sim/content",
    "@joes-sim/embed",
    "@joes-sim/engine",
    "@joes-sim/narration",
    "@joes-sim/ui",
  ],
  reactStrictMode: true,
  // Lessons are MDX files (brief, 8.2).
  pageExtensions: ["ts", "tsx", "mdx"],
};

export default createMDX({})(nextConfig);
