import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Some tests run every reference program many times; CI machines are slower under coverage.
    testTimeout: 30_000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/**/types.ts"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
    },
  },
});
