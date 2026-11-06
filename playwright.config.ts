import { defineConfig } from '@playwright/test'

// Browser tests drive the app the way a person does and check what they can
// see, plus what lands in the browser's storage. They run against the dev
// server: an already-running `npm run dev` on port 3000 is reused, otherwise
// one is started for the run.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Capped: every worker is a browser loading the app from one dev server,
  // and past a few at once the page loads, not the tests, set the pace.
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // The Chrome already installed on the machine, so `npm test` needs no
    // separate browser download.
    channel: 'chrome',
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    // The first request compiles the whole app.
    timeout: 180_000
  }
})
