import { defineConfig } from "vitest/config";
import path from "node:path";

// End-to-end: real `next start` production server + real MongoDB, driven over HTTP.
// Requires a production build: `npm run build` (or `npm run test:e2e`, which builds first).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts"],
    globalSetup: ["tests/e2e/global-setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
