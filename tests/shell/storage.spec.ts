import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { freshDataDir, launch, removeDataDir, type RunningApp } from './app'

// Projects saved as files on disk (issue #41). Every test runs the app on a
// fresh PIXEL_STITCH_DATA_DIR, so the files land in `<dataDir>/storage`.

let dataDir: string
let app: RunningApp | undefined

const storageDir = () => join(dataDir, 'storage')
const projectsDir = () => join(storageDir(), 'projects')

test.beforeEach(() => {
  dataDir = freshDataDir()
})

test.afterEach(async () => {
  allowWrites(projectsDir())
  await app?.close()
  app = undefined
  await removeDataDir(dataDir)
})

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}, `) })
const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')
const canvas = (page: Page) => panel(page).locator('main canvas')

async function createProject(page: Page, name: string) {
  await expect(page.getByRole('button', { name: /^(New project|Proyecto nuevo)$/ })).toBeVisible()
  if (await page.getByRole('textbox', { name: /^(Name|Nombre)$/ }).count() === 0) {
    await page.getByRole('button', { name: /^(New project|Proyecto nuevo)$/ }).click()
  }
  await page.getByRole('textbox', { name: /^(Name|Nombre)$/ }).fill(name)
  await page.getByRole('button', { name: /^(Create project|Crear proyecto)$/ }).click()
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

/** Magenta (the default colour) pixels on the visible artboard. */
function paintedOnScreen(page: Page) {
  return canvas(page).evaluate((element: HTMLCanvasElement) => {
    const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) count++
    }
    return count
  })
}

interface StoredProject {
  canvasSize: number
  frames: { layers: { data: string[][] }[] }[]
}

function projectFiles() {
  return existsSync(projectsDir()) ? readdirSync(projectsDir()).filter(name => name.endsWith('.tps')) : []
}

function readProject(file: string): StoredProject {
  return JSON.parse(readFileSync(join(projectsDir(), file), 'utf8'))
}

const paintedIn = (project: StoredProject) =>
  project.frames.flatMap(frame => frame.layers.flatMap(layer => layer.data.flat())).filter(Boolean).length

/** The one project file there is, once it holds this many painted pixels or more. */
async function savedWithPixels(atLeast: number) {
  let file = ''
  await expect.poll(() => {
    const files = projectFiles()
    if (files.length !== 1) return -1
    file = files[0]!
    try {
      return paintedIn(readProject(file))
    } catch {
      return -1
    }
  }, { timeout: 15_000 }).toBeGreaterThanOrEqual(atLeast)
  return file
}

// Windows ignores a folder's read-only flag, so the folder refuses new files
// through its permissions instead: everyone is denied writing into it.
function denyWrites(dir: string) {
  const result = spawnSync('icacls', [dir, '/deny', '*S-1-1-0:(OI)(CI)(W,D)'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`icacls failed: ${result.stdout}${result.stderr}`)
}

function allowWrites(dir: string) {
  if (existsSync(dir)) spawnSync('icacls', [dir, '/remove:d', '*S-1-1-0'])
}

/** Pixel Stitch's keys in the web engine's own storage. */
const keysInWebStorage = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('pixel-stitch')))

test('a project and its drawing come back after quitting, as a file in the storage folder', async () => {
  app = await launch(dataDir)
  await createProject(app.page, 'Keeper')
  await canvas(app.page).click({ position: { x: 20, y: 20 } })
  await canvas(app.page).click({ position: { x: 60, y: 60 } })
  const file = await savedWithPixels(2)
  const painted = await paintedOnScreen(app.page)
  expect(painted).toBeGreaterThan(0)
  expect(await keysInWebStorage(app.page)).toEqual([])
  await app.close()

  // Written the way Save → Project file writes one.
  const text = readFileSync(join(projectsDir(), file), 'utf8')
  expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2))
  // The palette only gets a file once it changes.
  expect(readdirSync(storageDir()).sort()).toEqual([
    'pixel-stitch-projects.json',
    'pixel-stitch-workspace.json',
    'projects'
  ])

  app = await launch(dataDir)
  await expect(tab(app.page, 'Keeper')).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => paintedOnScreen(app!.page)).toBe(painted)

  // A closed project opens from the start screen with its drawing already on
  // the board.
  await app.page.getByRole('button', { name: 'Close Keeper' }).click()
  await app.page.getByRole('button', { name: 'Open Keeper' }).click()
  await expect(tab(app.page, 'Keeper')).toHaveAttribute('aria-selected', 'true')
  expect(await paintedOnScreen(app.page)).toBe(painted)

  // The stored file imports as a project file.
  await panel(app.page).getByRole('button', { name: 'Import' }).click()
  const [chooser] = await Promise.all([
    app.page.waitForEvent('filechooser'),
    app.page.getByRole('menuitem', { name: /Project/ }).click()
  ])
  await chooser.setFiles(join(projectsDir(), file))
  const imported = file.replace(/\.tps$/, '')
  await expect(tab(app.page, imported)).toHaveAttribute('aria-selected', 'true')
  expect(await paintedOnScreen(app.page)).toBe(painted)
  expect(await keysInWebStorage(app.page)).toEqual([])
})

test('the open tabs, their order and the tab in front come back', async () => {
  app = await launch(dataDir)
  for (const name of ['First', 'Second', 'Third']) await createProject(app.page, name)
  await tab(app.page, 'Second').click()
  await expect.poll(() => {
    try {
      return JSON.parse(readFileSync(join(storageDir(), 'pixel-stitch-workspace.json'), 'utf8')).open.length
    } catch {
      return 0
    }
  }).toBe(3)
  await app.close()

  app = await launch(dataDir)
  await expect(app.page.getByRole('tab')).toHaveCount(3)
  for (const [position, name] of ['First', 'Second', 'Third'].entries()) {
    await expect(app.page.getByRole('tab').nth(position)).toHaveAccessibleName(new RegExp(`^${name}, `))
  }
  await expect(tab(app.page, 'Second')).toHaveAttribute('aria-selected', 'true')
})

test('far more work than browser storage holds saves and loads', async () => {
  // Thirty 128×128 projects with four frames each, seeded as files: tens of
  // megabytes, where browser storage stops at about five.
  mkdirSync(projectsDir(), { recursive: true })
  const now = Date.now()
  const index = []
  for (let n = 0; n < 30; n++) {
    const id = `seeded-${n}`
    const colour = n % 2 ? '#ff00ff' : '#00ff00'
    const grid = () => Array.from({ length: 128 }, () => Array<string>(128).fill(colour))
    const project = {
      version: 1,
      canvasSize: 128,
      fps: 8,
      currentFrameIndex: 0,
      frames: Array.from({ length: 4 }, (_, frame) => ({ id: frame + 1, layers: [{ id: 1, name: 'Layer 1', opacity: 1, data: grid() }] }))
    }
    writeFileSync(join(projectsDir(), `${id}.tps`), JSON.stringify(project, null, 2))
    index.push({ id, name: `Big ${n}`, canvasSize: 128, createdAt: now - n, updatedAt: now - n })
  }
  writeFileSync(join(storageDir(), 'pixel-stitch-projects.json'), JSON.stringify(index))

  app = await launch(dataDir)
  for (const n of [29, 1, 14]) {
    await app.page.getByRole('button', { name: `Open Big ${n}`, exact: true }).click()
    await expect(tab(app.page, `Big ${n}`)).toHaveAttribute('aria-selected', 'true')
    if (n % 2) expect(await paintedOnScreen(app.page)).toBeGreaterThan(0)
    else expect(await paintedOnScreen(app.page)).toBe(0)
    await app.page.getByRole('button', { name: 'New project' }).click()
  }

  // A stroke on one of them still reaches its file.
  await tab(app.page, 'Big 14').click()
  await canvas(app.page).click({ position: { x: 20, y: 20 } })
  const repainted = () => {
    const project = JSON.parse(readFileSync(join(projectsDir(), 'seeded-14.tps'), 'utf8')) as StoredProject
    return project.frames.flatMap(frame => frame.layers.flatMap(layer => layer.data.flat())).filter(colour => colour !== '#00ff00').length
  }
  await expect.poll(repainted, { timeout: 15_000 }).toBeGreaterThan(0)
})

for (const { locale, notice } of [
  { locale: 'en', notice: 'Couldn\'t save to disk' },
  { locale: 'es', notice: 'No se pudo guardar en el disco' }
]) {
  test(`a failed disk write says so once per run of failures (${locale})`, async () => {
    mkdirSync(storageDir(), { recursive: true })
    writeFileSync(join(storageDir(), 'pixel-stitch-locale.json'), JSON.stringify(locale))
    app = await launch(dataDir)
    const page = app.page
    await createProject(page, 'Stuck')
    await canvas(page).click({ position: { x: 20, y: 20 } })
    await savedWithPixels(1)

    // Counts the disk notices the notice line puts up. Each notice is a new
    // element, even when the same one is still on screen.
    await page.evaluate((text) => {
      const w = window as unknown as { diskNotices: number }
      w.diskNotices = 0
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.textContent?.includes(text)) w.diskNotices++
          }
        }
      }).observe(document.body, { subtree: true, childList: true })
    }, notice)
    const notices = () => page.evaluate(() => (window as unknown as { diskNotices: number }).diskNotices)

    denyWrites(projectsDir())
    // Several autosaves in a row, each past the one-second autosave delay.
    for (const at of [40, 60, 80, 100]) {
      await canvas(page).click({ position: { x: at, y: at } })
      await page.waitForTimeout(1400)
    }
    expect(await notices()).toBe(1)
    expect(await keysInWebStorage(page)).toEqual([])

    // Once the disk takes writes again, the next save lands, and a later
    // failure is a new run that gets its own notice.
    allowWrites(projectsDir())
    await canvas(page).click({ position: { x: 120, y: 120 } })
    await savedWithPixels(6)
    denyWrites(projectsDir())
    await canvas(page).click({ position: { x: 140, y: 140 } })
    await expect.poll(notices).toBe(2)
  })
}
