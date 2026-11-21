import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against the production static export (./out), served by a
 * plain static file server — the same artefact Netlify publishes.
 *
 *   npm run build && npm run e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/serve.mjs out 4173",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "ignore",
    timeout: 30_000,
  },
});
