import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The tests start a local D1 database (Miniflare) and run challenge solutions.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test-db.ts"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
