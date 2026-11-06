import { expect, test, type Page } from '@playwright/test'

// Pixel Stitch with several projects, each in its own tab (issue #32). Every
// test starts in a fresh browser context, so storage is empty unless the test
// seeds it.

const TOOL = '/make/pixel-stitch'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}, `) })
const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')
const canvas = (page: Page) => panel(page).locator('main canvas')

async function openTool(page: Page) {
  await page.goto(TOOL)
  // The dev server serves every module separately, so a first load with
  // several test windows opening at once can take well past the usual wait.
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible({ timeout: 30_000 })
}

async function createProject(page: Page, name: string, size = 32) {
  if (await page.getByRole('button', { name: 'Create project' }).count() === 0) {
    await page.getByRole('button', { name: 'New project' }).click()
  }
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('radiogroup').getByText(`${size}×${size}`, { exact: true }).click()
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

async function draw(page: Page) {
  await canvas(page).click({ position: { x: 20, y: 20 } })
}

/** Painted pixels in a project's stored document, across every frame and layer. */
function storedPixels(page: Page, name: string) {
  return page.evaluate((projectName) => {
    const index = JSON.parse(localStorage.getItem('pixel-stitch-projects') ?? '[]') as { id: string, name: string }[]
    const entry = index.find(project => project.name === projectName)
    if (!entry) return -1
    const doc = JSON.parse(localStorage.getItem(`pixel-stitch-project:${entry.id}`) ?? 'null')
    if (!doc) return -1
    return (doc.frames as { layers: { data: string[][] }[] }[])
      .flatMap(frame => frame.layers.flatMap(layer => layer.data.flat()))
      .filter(Boolean).length
  }, name)
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

test('a first visit lands on the start screen with a suggested name', async ({ page }) => {
  await openTool(page)
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Untitled 1')
  await expect(page.getByText('No projects yet.')).toBeVisible()

  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(tab(page, 'Untitled 1')).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Untitled 2')
})

test('each board size opens a tab with a board of that size', async ({ page }) => {
  await openTool(page)
  for (const size of [16, 32, 64, 128]) {
    await createProject(page, `Board ${size}`, size)
    await expect(tab(page, `Board ${size}`)).toHaveAccessibleName(`Board ${size}, ${size}×${size}`)
    await expect(panel(page).getByRole('button', { name: 'Canvas', exact: true })).toContainText(`${size}×${size}`)
  }
  await expect(page.getByRole('tab')).toHaveCount(4)
})

test('the tab strip never scrolls vertically', async ({ page }) => {
  await openTool(page)
  const tablist = page.getByRole('tablist', { name: 'Open projects' })
  const overflowsVertically = () => tablist.evaluate(element => element.scrollHeight > element.clientHeight)

  expect(await overflowsVertically()).toBe(false)
  await createProject(page, 'Only tab')
  expect(await overflowsVertically()).toBe(false)
  await page.getByRole('button', { name: 'New project' }).click()
  expect(await overflowsVertically()).toBe(false)
})

test('an empty name cannot be created', async ({ page }) => {
  await openTool(page)
  await page.getByRole('textbox', { name: 'Name' }).fill('   ')
  await expect(page.getByRole('button', { name: 'Create project' })).toBeDisabled()
})

test('drawing and undo stay inside their own tab', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Hero')
  await draw(page)
  await expect.poll(() => storedPixels(page, 'Hero')).toBeGreaterThan(0)

  await createProject(page, 'Coin')
  expect(await paintedOnScreen(page)).toBe(0)
  await expect(panel(page).getByRole('button', { name: 'Undo the last action' })).toBeDisabled()

  // Undo in the other tab must not reach back into Hero.
  await page.keyboard.press('Control+z')
  await tab(page, 'Hero').click()
  expect(await paintedOnScreen(page)).toBeGreaterThan(0)

  await page.keyboard.press('Control+z')
  expect(await paintedOnScreen(page)).toBe(0)
  await expect.poll(() => storedPixels(page, 'Coin')).toBe(0)
})

test('the pencil cursor shows the selected colour; the eraser cursor stays hollow', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Cursor')
  const cursor = panel(page).getByTestId('brush-cursor')

  await canvas(page).hover({ position: { x: 40, y: 40 } })
  await expect(cursor).toHaveCSS('background-color', 'rgb(255, 0, 255)')

  await panel(page).getByRole('button', { name: 'Eraser', exact: true }).click()
  await canvas(page).hover({ position: { x: 60, y: 60 } })
  await expect(cursor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

test('closing a tab keeps the project, and reopening brings the drawing back', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Keeper')
  await draw(page)
  // Closed straight away, inside the autosave delay: the last stroke still lands.
  await page.getByRole('button', { name: 'Close Keeper' }).click()
  expect(await storedPixels(page, 'Keeper')).toBeGreaterThan(0)

  // That was the last tab, so the start screen is back.
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(1)

  await page.getByRole('button', { name: 'Open Keeper' }).click()
  await expect(tab(page, 'Keeper')).toHaveAttribute('aria-selected', 'true')
  expect(await paintedOnScreen(page)).toBeGreaterThan(0)
})

test('opening a project does not count as editing it', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Untouched')
  const editedAt = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem('pixel-stitch-projects') ?? '[]') as { updatedAt: number }[])[0]?.updatedAt)
  const before = await editedAt()

  await page.getByRole('button', { name: 'Close Untouched' }).click()
  await page.getByRole('button', { name: 'Open Untouched' }).click()
  // Past the autosave delay, so a save triggered by loading would have landed.
  await page.waitForTimeout(1500)
  expect(await editedAt()).toBe(before)
})

test('closing the active tab moves to its neighbour', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'One')
  await createProject(page, 'Two')
  await createProject(page, 'Three')
  await tab(page, 'Two').click()
  await page.getByRole('button', { name: 'Close Two' }).click()
  await expect(tab(page, 'Three')).toHaveAttribute('aria-selected', 'true')
})

test('opening a project that is already open switches to its tab', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Solo')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('button', { name: 'Switch to Solo' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(tab(page, 'Solo')).toHaveAttribute('aria-selected', 'true')
})

test('a reload restores the open tabs, their order and the one in front', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Alpha')
  await createProject(page, 'Beta')
  await createProject(page, 'Gamma')
  await tab(page, 'Beta').click()

  await page.reload()
  await expect(page.getByRole('tab')).toHaveText(['32Alpha', '32Beta', '32Gamma'])
  await expect(tab(page, 'Beta')).toHaveAttribute('aria-selected', 'true')
})

test('the arrow keys move between tabs', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Left')
  await createProject(page, 'Right')
  await tab(page, 'Right').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(tab(page, 'Left')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Left')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(tab(page, 'Right')).toBeFocused()
})

test('a project can be renamed from its tab', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Draft')
  await tab(page, 'Draft').dblclick()
  const field = page.getByRole('textbox', { name: 'Project name' })
  await field.fill('Final sprite')
  await field.press('Enter')
  await expect(tab(page, 'Final sprite')).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pixel-stitch-projects'))).toContain('Final sprite')
})

test('deleting an open project closes its tab and removes it from storage', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Doomed')
  await createProject(page, 'Survivor')
  await page.getByRole('button', { name: 'New project' }).click()

  await page.getByRole('button', { name: 'Delete Doomed' }).hover()
  await page.mouse.down()
  await page.waitForTimeout(1500)
  await page.mouse.up()

  await expect(tab(page, 'Doomed')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Doomed/ })).toHaveCount(0)
  await expect(tab(page, 'Survivor')).toHaveCount(1)
  await expect.poll(() => storedPixels(page, 'Doomed')).toBe(-1)
  const leftovers = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('pixel-stitch-project:')).length)
  expect(leftovers).toBe(1)
})

test('a drawing from before projects existed opens as "Untitled 1"', async ({ page }) => {
  const legacy = {
    version: 1,
    canvasSize: 16,
    fps: 8,
    currentFrameIndex: 0,
    frames: [{ id: 1, layers: [{ id: 1, name: 'Layer 1', opacity: 1, data: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x === y ? '#FF00FF' : ''))) }] }]
  }
  await page.addInitScript((doc) => {
    if (!localStorage.getItem('pixel-stitch-projects')) localStorage.setItem('pixel-stitch-project', JSON.stringify(doc))
  }, legacy)

  await openTool(page)
  await expect(tab(page, 'Untitled 1')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Untitled 1')).toHaveAccessibleName('Untitled 1, 16×16')
  expect(await paintedOnScreen(page)).toBeGreaterThan(0)
  expect(await page.evaluate(() => localStorage.getItem('pixel-stitch-project'))).toBeNull()
  expect(await storedPixels(page, 'Untitled 1')).toBe(16)
})

test('save names the project file after the project; import opens a file in a new tab', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Hero walk')

  await panel(page).getByRole('button', { name: 'Save' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Project/ }).click()
  ])
  expect(download.suggestedFilename()).toBe('Hero walk.tps')

  const file = {
    version: 1,
    canvasSize: 64,
    fps: 8,
    currentFrameIndex: 0,
    frames: [{ id: 1, layers: [{ id: 1, name: 'Layer 1', opacity: 1, data: Array.from({ length: 64 }, () => Array(64).fill('')) }] }]
  }
  await panel(page).getByRole('button', { name: 'Import' }).click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: /Project/ }).click()
  ])
  await chooser.setFiles({ name: 'dragon-idle.tps', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })

  await expect(tab(page, 'dragon-idle')).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'dragon-idle')).toHaveAccessibleName('dragon-idle, 64×64')
  await expect(tab(page, 'Hero walk')).toBeVisible()
})

test('a save that does not fit in storage says so', async ({ page }) => {
  await openTool(page)
  await createProject(page, 'Too big')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('pixel-stitch-project:')) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await draw(page)
  await expect(panel(page).getByText("Couldn't save: this browser's storage is full.", { exact: false })).toBeVisible()
})
