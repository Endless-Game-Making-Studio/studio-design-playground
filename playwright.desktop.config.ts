import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// The desktop bundle (`npm run build:desktop`), served as plain static files
// and driven with the same Pixel Stitch spec the web build runs, in a Chromium
// engine (close to the shell's WebView2 on Windows) and a WebKit engine (close
// to WebKitGTK on Linux). Run with `npm run test:desktop`.
const port = Number(process.env.PW_PORT ?? 4173)
const proxyPort = Number(process.env.PW_PROXY_PORT ?? port + 1)

// The spec reads the tool's address from here: the bundle's root on desktop,
// the Make page on the web. Set in the config so every worker sees it.
process.env.PIXEL_STITCH_URL = '/'

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/pixel-stitch-*.spec.ts', 'desktop/*.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  // Every request goes through a proxy that refuses remote origins and fails
  // the run if any were asked for (tests/desktop/global-setup.mjs).
  globalSetup: './tests/desktop/global-setup.mjs',
  metadata: {
    remoteGuard: { port: proxyPort, logFile: join(tmpdir(), `pixel-stitch-remote-requests-${port}.log`) }
  },
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    proxy: { server: `http://127.0.0.1:${proxyPort}`, bypass: 'localhost,127.0.0.1' }
  },
  projects: [
    // Playwright's own Chromium rather than the installed Chrome: branded
    // Chrome calls Google services on launch by itself, and the guard can't
    // tell those calls apart from the page's.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } }
  ],
  webServer: {
    command: `node scripts/serve-static.mjs .output-desktop/public ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false
  }
})
