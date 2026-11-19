import { expect, test } from '@playwright/test'
import { allWindows, appWindows, dragCorner, freshDataDir, launch, maximize, minimize, place, pressKeys, removeDataDir, rightClick, startAppLikeTheShell, type RunningApp } from './app'

// The real desktop app on Windows (issue #40): the executable, its window and
// its WebView2, launched on a fresh profile folder in every test.

let dataDir: string
let app: RunningApp | undefined

test.beforeEach(() => {
  dataDir = freshDataDir()
})

test.afterEach(async () => {
  await app?.close()
  app = undefined
  await removeDataDir(dataDir)
})

const viewport = (running: RunningApp) => running.page.evaluate(() => ({ width: innerWidth, height: innerHeight }))

test('the first launch opens the start screen in a window of its own', async () => {
  app = await launch(dataDir)

  await expect(app.page.getByRole('button', { name: 'Create project' })).toBeVisible()
  await expect(app.page.getByRole('textbox', { name: 'Name' })).toBeVisible()
  expect(app.window().title).toBe('Pixel Stitch')

  // Everything comes from the bundle inside the executable, which WebView2
  // serves from http://tauri.localhost, and the calls to the app's own
  // commands (reading the projects from disk) go to http://ipc.localhost,
  // which Tauri answers in-process. Loaded again with the spec watching,
  // since the first load was over before it attached.
  const requested: string[] = []
  app.page.on('request', request => requested.push(request.url()))
  await app.page.reload()
  await expect(app.page.getByRole('button', { name: 'Create project' })).toBeVisible()
  await app.page.evaluate(() => document.fonts.ready)
  expect(requested.length).toBeGreaterThan(0)
  expect(requested.filter(url => !/^(http:\/\/(tauri|ipc)\.localhost\/|data:|blob:)/.test(url))).toEqual([])
})

test('a second launch focuses the running window instead of opening another', async () => {
  app = await launch(dataDir)
  await expect(app.page.getByRole('button', { name: 'Create project' })).toBeVisible()
  const first = app.window()
  // Out of the way first, so coming back is the second launch's doing.
  minimize(first)
  await expect.poll(() => app!.window().minimized).toBe(true)

  // Launched as the Start menu would: only a program the shell started may
  // bring a window to the front, and the second instance passes that on to
  // the first. It then exits by itself.
  expect(startAppLikeTheShell(dataDir)).toBe(0)

  const { processes, windows } = appWindows()
  expect(processes).toEqual([app.pid])
  expect(windows).toHaveLength(1)
  await expect.poll(() => app!.window()).toMatchObject({ hwnd: first.hwnd, minimized: false, foreground: true })
})

test('the window comes back at its size and place, and maximised', async () => {
  app = await launch(dataDir)
  place(app.window(), { x: 120, y: 90, width: 1100, height: 760 })
  await expect.poll(() => app!.window()).toMatchObject({ x: 120, y: 90, width: 1100, height: 760 })
  await app.close()

  app = await launch(dataDir)
  expect(app.window()).toMatchObject({ x: 120, y: 90, width: 1100, height: 760, maximized: false })
  maximize(app.window())
  await expect.poll(() => app!.window().maximized).toBe(true)
  await app.close()

  app = await launch(dataDir)
  expect(app.window().maximized).toBe(true)
})

test('the window stops at the minimum size', async () => {
  app = await launch(dataDir)
  await expect(app.page.getByRole('button', { name: 'Create project' })).toBeVisible()

  place(app.window(), { x: 100, y: 100, width: 1200, height: 800 })
  await expect.poll(() => app!.window()).toMatchObject({ width: 1200, height: 800 })
  // Far past the minimum, towards the window's top-left corner.
  dragCorner(app.window(), { x: 300, y: 250 })

  // The shell's minimum, in the page's own pixels (src-tauri/src/main.rs).
  await expect.poll(() => viewport(app!)).toEqual({ width: 970, height: 640 })
})

// Release builds only: a debug build keeps all of these on, for working on the app.
test('web page keys and the right-click menu are off, and the tool\'s own shortcuts work', async () => {
  app = await launch(dataDir)
  const { page } = app
  await page.getByRole('button', { name: 'Create project' }).click()
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await expect(undo).toBeDisabled()
  await page.locator('[role="tabpanel"]:visible main canvas').click({ position: { x: 20, y: 20 } })
  await expect(undo).toBeEnabled()

  // The marker lasts until the page reloads. The key log is there to prove
  // each key reached the page, so a lost key can't pass for a blocked one.
  await page.evaluate(() => {
    const log: string[] = []
    Object.assign(window, { shellSpecMarker: true, shellSpecKeys: log })
    addEventListener('keydown', (event) => {
      if (!['Control', 'Shift', 'Alt'].includes(event.key)) log.push([event.ctrlKey && 'Ctrl', event.shiftKey && 'Shift', event.key].filter(Boolean).join('+'))
    })
  })
  const zoom = () => page.evaluate(() => ({ ratio: devicePixelRatio, width: innerWidth }))
  const before = await zoom()
  const windowsBefore = allWindows(app.pid).length

  // Reload, hard reload, zoom in and out (main keys and keypad), developer
  // tools and the console, then the tool's own undo.
  pressKeys(app.window(), '{F5}^r^+r^{ADD}^=^{SUBTRACT}^-{F12}^+i^+j^z')
  expect(await page.evaluate(() => (window as unknown as { shellSpecKeys: string[] }).shellSpecKeys)).toEqual([
    'F5', 'Ctrl+r', 'Ctrl+Shift+R', 'Ctrl++', 'Ctrl+=', 'Ctrl+-', 'Ctrl+-', 'F12', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+z'
  ])
  await expect(undo).toBeDisabled()
  expect(await page.evaluate(() => 'shellSpecMarker' in window)).toBe(true)
  expect(await zoom()).toEqual(before)

  // On the tab bar's empty stretch, clear of the canvas, which has its own
  // right-click; the window's frame and title bar sit above it.
  rightClick(app.window(), { x: 700, y: 60 })
  // No developer tools window and no menu.
  expect(allWindows(app.pid)).toHaveLength(windowsBefore)
})
