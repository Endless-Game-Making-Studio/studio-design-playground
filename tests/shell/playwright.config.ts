import { defineConfig } from '@playwright/test'

// The real desktop executable on Windows, driven through its WebView2. Run
// with `npm run test:shell` after `npm run desktop:build`; app.ts says what
// the spec launches and how. Kept apart from `npm test` and
// `npm run test:desktop`, which need neither the Rust toolchain nor a built app.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // One app at a time: it's a single-instance app, so a second worker's
  // launch would only hand over to the first worker's window.
  workers: 1,
  fullyParallel: false,
  reporter: 'list'
})
