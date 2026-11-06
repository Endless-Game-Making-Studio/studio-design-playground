import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { appWindows, freshDataDir, launch, removeDataDir, type RunningApp } from './app'
import { allowWrites, canvas, createProject, denyWrites, paintedInFile, paintedOnScreen, tab } from './projects'

// Closing the window (issue #42). Autosave waits a second after each change,
// so the app has to write what is still waiting before it quits.

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

/** A project's file, found by the name the start screen shows. */
function projectFile(name: string) {
  const index = JSON.parse(readFileSync(join(storageDir(), 'pixel-stitch-projects.json'), 'utf8')) as { id: string, name: string }[]
  const project = index.find(entry => entry.name === name)
  if (!project) throw new Error(`No project named ${name}`)
  return join(projectsDir(), `${project.id}.tps`)
}

const appRunning = () => appWindows().processes.length > 0

test('a stroke made just before closing the window is kept, in every open tab', async () => {
  app = await launch(dataDir)
  const page = app.page
  await createProject(page, 'Behind')
  await createProject(page, 'Front')
  await expect.poll(() => paintedInFile(projectFile('Behind'))).toBe(0)
  await expect.poll(() => paintedInFile(projectFile('Front'))).toBe(0)

  // One stroke in each tab, then straight to the close button: well inside the
  // autosave delay, so both are still waiting when the window is asked to close.
  const close = await app.armClose()
  await tab(page, 'Behind').click()
  await canvas(page).click({ position: { x: 20, y: 20 } })
  await tab(page, 'Front').click()
  await canvas(page).click({ position: { x: 40, y: 40 } })
  const { forced } = await close()
  app = undefined

  expect(forced).toBe(false)
  expect(paintedInFile(projectFile('Behind'))).toBe(1)
  expect(paintedInFile(projectFile('Front'))).toBe(1)

  app = await launch(dataDir)
  await expect(tab(app.page, 'Front')).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => paintedOnScreen(app!.page)).toBeGreaterThan(0)
  await tab(app.page, 'Behind').click()
  await expect.poll(() => paintedOnScreen(app!.page)).toBeGreaterThan(0)
})

test('closing with nothing waiting to be saved quits straight away', async () => {
  app = await launch(dataDir)
  await createProject(app.page, 'Settled')
  await canvas(app.page).click({ position: { x: 20, y: 20 } })
  await expect.poll(() => paintedInFile(projectFile('Settled'))).toBe(1)

  const started = Date.now()
  const { forced } = await app.close()
  app = undefined
  expect(forced).toBe(false)
  expect(Date.now() - started).toBeLessThan(3_000)
})

for (const { locale, notice, title, stay, quit } of [
  { locale: 'en', notice: 'Couldn\'t save to disk', title: 'Quit without saving?', stay: 'Don\'t quit', quit: 'Quit anyway' },
  { locale: 'es', notice: 'No se pudo guardar en el disco', title: '¿Salir sin guardar?', stay: 'No salir', quit: 'Salir de todos modos' }
]) {
  test(`a write that fails on close asks whether to quit anyway (${locale})`, async () => {
    mkdirSync(storageDir(), { recursive: true })
    writeFileSync(join(storageDir(), 'pixel-stitch-locale.json'), JSON.stringify(locale))
    app = await launch(dataDir)
    const page: Page = app.page
    await createProject(page, 'Stuck')
    await canvas(page).click({ position: { x: 20, y: 20 } })
    await expect.poll(() => paintedInFile(projectFile('Stuck'))).toBe(1)
    const file = projectFile('Stuck')

    denyWrites(projectsDir())
    await canvas(page).click({ position: { x: 60, y: 60 } })
    const painted = await paintedOnScreen(page)
    app.requestClose()

    const prompt = page.getByRole('dialog', { name: title })
    await expect(prompt).toBeVisible()
    await expect(prompt).toContainText(notice)

    // Not quitting keeps the window and the drawing.
    await prompt.getByRole('button', { name: stay, exact: true }).click()
    await expect(prompt).toBeHidden()
    // Past the shell's own deadline for a page that never answers.
    await page.waitForTimeout(11_000)
    expect(appRunning()).toBe(true)
    expect(app.window().title).toBe('Pixel Stitch')
    expect(await paintedOnScreen(page)).toBe(painted)

    // Asked again with the disk still refusing, quitting anyway quits.
    app.requestClose()
    await expect(prompt).toBeVisible()
    await prompt.getByRole('button', { name: quit, exact: true }).click()
    expect(await app.exited).toBe(0)
    app = undefined
    allowWrites(projectsDir())
    expect(paintedInFile(file)).toBe(1)
  })
}

test('closing after a failed write quits once the disk takes the write again', async () => {
  app = await launch(dataDir)
  const page = app.page
  await createProject(page, 'Recovers')
  await canvas(page).click({ position: { x: 20, y: 20 } })
  await expect.poll(() => paintedInFile(projectFile('Recovers'))).toBe(1)
  const file = projectFile('Recovers')

  denyWrites(projectsDir())
  await canvas(page).click({ position: { x: 60, y: 60 } })
  app.requestClose()
  const prompt = page.getByRole('dialog', { name: 'Quit without saving?' })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Don\'t quit', exact: true }).click()

  allowWrites(projectsDir())
  const { forced } = await app.close()
  app = undefined
  expect(forced).toBe(false)
  expect(paintedInFile(file)).toBe(2)
})

