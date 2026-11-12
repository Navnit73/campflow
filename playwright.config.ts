import { defineConfig, devices } from "@playwright/test";

// Browser UI journeys against the production build (`npm run build` first; `npm run test:ui` does it).
// The server uses a throwaway in-memory MongoDB (ALLOW_IN_MEMORY_DB) so runs are isolated.
const PORT = 3099;

export default defineConfig({
  testDir: "tests/ui",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      ALLOW_IN_MEMORY_DB: "true",
      MONGODB_URI: "",
      JWT_SECRET: "ui_test_jwt_secret_that_is_long_enough_123456",
      DISABLE_RATE_LIMIT: "true",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "",
    },
  },
});
