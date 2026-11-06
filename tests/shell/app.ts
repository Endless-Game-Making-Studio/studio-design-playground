import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect, type Browser, type Page } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The release executable from `npm run desktop:build`. Developer tools are off
 * in it, but WebView2 still opens the remote debugging port that
 * WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS asks for, so the spec drives the same
 * build that ships. PIXEL_STITCH_EXE points it at another build.
 */
export const exe = resolve(process.env.PIXEL_STITCH_EXE ?? join(here, '../../src-tauri/target/release/pixel-stitch.exe'))
const processName = 'pixel-stitch'
const debugPort = Number(process.env.PW_SHELL_DEBUG_PORT ?? 3340)

/** A folder for one test's profile: the web engine's storage and the window state. */
export function freshDataDir() {
  return mkdtempSync(join(tmpdir(), 'pixel-stitch-shell-'))
}

export async function removeDataDir(dir: string) {
  // WebView2's helper processes can hold files for a moment after the app exits.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch {
      await new Promise(done => setTimeout(done, 250))
    }
  }
}

export interface AppWindow {
  hwnd: string
  pid: number
  title: string
  foreground: boolean
  minimized: boolean
  maximized: boolean
  x: number
  y: number
  width: number
  height: number
}

function windowsHelper(...args: string[]) {
  return windowsHelperWith(process.env, ...args)
}

function windowsHelperWith(env: NodeJS.ProcessEnv, ...args: string[]) {
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'windows.ps1'), ...args], { encoding: 'utf8', env })
  if (result.status !== 0) throw new Error(`windows.ps1 ${args.join(' ')} failed: ${result.stderr}`)
  return JSON.parse(result.stdout)
}

/** Every running Pixel Stitch process, and their visible windows with a title bar. */
export function appWindows(): { processes: number[], windows: AppWindow[] } {
  return windowsHelper('list', processName)
}

export const minimize = (window: AppWindow) => windowsHelper('minimize', window.hwnd)
export const maximize = (window: AppWindow) => windowsHelper('maximize', window.hwnd)
/** Drags the window's bottom-right corner to a point on screen, as a person resizing it would. */
export const dragCorner = (window: AppWindow, to: { x: number, y: number }) =>
  windowsHelper('drag-corner', window.hwnd, String(to.x), String(to.y))
export const place = (window: AppWindow, box: { x: number, y: number, width: number, height: number }) =>
  windowsHelper('place', window.hwnd, ...[box.x, box.y, box.width, box.height].map(String))

/**
 * Real key presses, in SendKeys notation (`^r` is Ctrl+R, `{F5}` is F5). They
 * take the keyboard's path, so the web engine's own shortcuts see them, which
 * Playwright's keyboard (sent straight to the page) would skip.
 */
export const pressKeys = (window: AppWindow, keys: string) => windowsHelper('keys', window.hwnd, keys)

/** A real right-click at a point inside the window. */
export const rightClick = (window: AppWindow, at: { x: number, y: number }) =>
  windowsHelper('right-click', window.hwnd, String(at.x), String(at.y))

/** Every visible window of the app and its web engine: menus, popups and developer tools too. */
export function allWindows(pid: number): AppWindow[] {
  return windowsHelper('list-all', String(pid)).windows
}

const appEnv = (dataDir: string) => ({
  ...process.env,
  PIXEL_STITCH_DATA_DIR: dataDir,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`
})

/** Starts the app on a profile folder. `exited` resolves with its exit code. */
export function startApp(dataDir: string) {
  const child = spawn(exe, [], { env: appEnv(dataDir), stdio: 'ignore' })
  const exited = new Promise<number | null>(done => child.on('exit', code => done(code)))
  return { pid: child.pid!, exited, kill: () => child.kill() }
}

/**
 * Starts the app the way the Start menu or Explorer would, with the right to
 * take the foreground that a program launched by the shell has. A program
 * started from this background test process has no such right. Returns once
 * it exits, with its exit code.
 */
export function startAppLikeTheShell(dataDir: string): number {
  return windowsHelperWith(appEnv(dataDir), 'start', exe).exitCode
}

export interface RunningApp {
  pid: number
  page: Page
  /** The app's one top-level window, as Windows sees it now. */
  window: () => AppWindow
  /** Closes the window the way its close button does and waits for the app to exit. */
  close: () => Promise<void>
}

/** Launches the app and attaches to its WebView2. */
export async function launch(dataDir: string): Promise<RunningApp> {
  if (!existsSync(exe)) throw new Error(`No app at ${exe}. Build it with \`npm run desktop:build\`.`)
  if (appWindows().processes.length > 0) throw new Error('Pixel Stitch is already running. Close it first: launching it again would only focus it.')

  const app = startApp(dataDir)
  const ownWindows = () => appWindows().windows.filter(window => window.pid === app.pid)
  const browser = await attach()
  await expect.poll(() => browser.contexts()[0]?.pages().length ?? 0, { timeout: 30_000 }).toBeGreaterThan(0)
  const page = browser.contexts()[0]!.pages()[0]!
  await expect.poll(() => ownWindows().length).toBe(1)

  return {
    pid: app.pid,
    page,
    window: () => {
      const own = ownWindows()
      if (own.length !== 1) throw new Error(`Expected one Pixel Stitch window, found ${own.length}`)
      return own[0]!
    },
    close: async () => {
      await browser.close().catch(() => {})
      for (const window of ownWindows()) windowsHelper('close', window.hwnd)
      const timedOut = await Promise.race([app.exited.then(() => false), new Promise(done => setTimeout(done, 15_000, true))])
      if (timedOut) app.kill()
      await app.exited
    }
  }
}

async function attach(): Promise<Browser> {
  const deadline = Date.now() + 30_000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
    } catch (error) {
      lastError = error
      await new Promise(done => setTimeout(done, 250))
    }
  }
  throw new Error(`Couldn't attach to the app's WebView2 on port ${debugPort}: ${lastError}`)
}
