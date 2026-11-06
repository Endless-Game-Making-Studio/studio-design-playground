import { expect, test, type Page } from '@playwright/test'
import { calls, setShell, withFakeShell } from './fakeShell'

// The desktop host's Save and Open windows (issue #43). The real windows are
// the operating system's and can't be driven by a test, so these runs stand in
// for the shell (./fakeShell.ts) and check what the page asks of it. What
// reaches the real windows is checked by hand
// (docs/pixel-stitch-desktop-release-checklist.md).

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}, `) })
const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')

async function openTool(page: Page, newProject = 'New project') {
  await page.goto('/')
  await expect(page.getByRole('button', { name: newProject })).toBeVisible({ timeout: 30_000 })
}

async function createProject(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

async function chooseFrom(page: Page, menu: 'Save' | 'Import', item: RegExp) {
  await panel(page).getByRole('button', { name: menu }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

const bytesOf = (text: string) => Array.from(Buffer.from(text))
const textOf = (bytes: number[]) => Buffer.from(bytes).toString('utf8')

const PROJECT_TYPE = { description: 'Pixel Stitch project', extensions: ['tps', 'json'] }
const PNG_TYPE = { description: 'PNG image', extensions: ['png'] }
const IMAGE_TYPE = { description: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }

/** A 16×16 project with two frames of two layers each, a pixel on each layer. */
function layeredProject() {
  const grid = (x: number, colour: string) =>
    Array.from({ length: 16 }, (_, row) => Array.from({ length: 16 }, (_, col) => (row === 0 && col === x ? colour : '')))
  return {
    version: 1,
    canvasSize: 16,
    fps: 6,
    currentFrameIndex: 0,
    frames: [1, 2].map(frame => ({
      id: frame,
      layers: [
        { id: 1, name: 'Outline', opacity: 1, data: grid(frame, '#000000') },
        { id: 2, name: 'Fill', opacity: 0.5, data: grid(frame + 4, '#FF00FF') }
      ]
    }))
  }
}

test.describe('inside the shell', () => {
  test.use({ locale: 'en-US' })
  test.beforeEach(({ page }) => withFakeShell(page))

  test('Save → Project file offers the project\'s name and only project files, and writes the project there', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')

    await chooseFrom(page, 'Save', /Project/)
    await expect(panel(page).getByText('Project saved')).toBeVisible()

    expect(await calls(page, 'save_dialog')).toEqual([{ suggestedName: 'Hero walk.tps', types: [PROJECT_TYPE] }])
    const written = await page.evaluate(() => window.__shell.written)
    expect(written).toHaveLength(1)
    expect(JSON.parse(textOf(written[0]!))).toMatchObject({ version: 1, canvasSize: 32 })
  })

  test('cancelling the Save window writes nothing and says nothing', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    await setShell(page, { save: 'cancel' })

    await chooseFrom(page, 'Save', /Project/)
    await expect.poll(() => calls(page, 'save_dialog')).toHaveLength(1)

    expect(await calls(page, 'write_saved_file')).toHaveLength(0)
    await expect(panel(page).getByText('Project saved')).toBeHidden()
  })

  test('a file the shell can\'t write says so, for a project and for an export', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    await setShell(page, { save: 'unwritable' })

    await chooseFrom(page, 'Save', /Project/)
    await expect(panel(page).getByText('Couldn\'t save the file there. Pick another folder, or check that there\'s free space.')).toBeVisible()
    await expect(panel(page).getByText('Project saved')).toBeHidden()

    await chooseFrom(page, 'Save', /PNG/)
    await expect.poll(() => calls(page, 'write_saved_file')).toHaveLength(2)
    await expect(panel(page).getByText(/Couldn't save the file there/).first()).toBeVisible()
    await expect(panel(page).getByText('Frame exported')).toBeHidden()
  })

  test('exports offer only their own file type', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')

    await chooseFrom(page, 'Save', /PNG/)
    await expect(panel(page).getByText('Frame exported')).toBeVisible()

    await chooseFrom(page, 'Save', /Sprite sheet/)
    await page.getByRole('dialog', { name: 'Export sprite sheet' }).getByRole('button', { name: 'Export' }).click()
    await expect(panel(page).getByText('Sprite sheet exported')).toBeVisible()

    expect(await calls(page, 'save_dialog')).toEqual([
      { suggestedName: 'pixel-art-frame-1.png', types: [PNG_TYPE] },
      { suggestedName: 'sprite-sheet.png', types: [PNG_TYPE] }
    ])
    // Each export's bytes reach the shell as they are: a PNG starts with its signature.
    const written = await page.evaluate(() => window.__shell.written)
    expect(written.map(bytes => bytes.slice(1, 4))).toEqual([[0x50, 0x4E, 0x47], [0x50, 0x4E, 0x47]])
  })

  test('a GIF export offers only GIF files', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    // An animation needs two frames; a two-frame project file is the quickest way there.
    await setShell(page, { open: { name: 'walk.tps', bytes: bytesOf(JSON.stringify(layeredProject())) } })
    await chooseFrom(page, 'Import', /Project/)
    await expect(tab(page, 'walk')).toHaveAttribute('aria-selected', 'true')

    await chooseFrom(page, 'Save', /GIF/)
    await expect(panel(page).getByText('GIF exported')).toBeVisible({ timeout: 20_000 })

    expect(await calls(page, 'save_dialog')).toEqual([
      { suggestedName: 'pixel-art-animation.gif', types: [{ description: 'GIF animation', extensions: ['gif'] }] }
    ])
  })

  test('Import → Project file opens project files only, in a new tab named after the file', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    await setShell(page, { open: { name: 'dragon-idle.tps', bytes: bytesOf(JSON.stringify(layeredProject())) } })

    await chooseFrom(page, 'Import', /Project/)

    await expect(tab(page, 'dragon-idle')).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 'dragon-idle')).toHaveAccessibleName('dragon-idle, 16×16')
    await expect(tab(page, 'Hero walk')).toBeVisible()
    expect(await calls(page, 'open_dialog')).toEqual([{ types: [PROJECT_TYPE] }])
  })

  test('cancelling the Open window opens nothing and says nothing', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    await setShell(page, { open: null })

    await chooseFrom(page, 'Import', /Project/)
    await expect.poll(() => calls(page, 'open_dialog')).toHaveLength(1)

    await expect(page.getByRole('tab')).toHaveCount(1)
    expect(await calls(page, 'read_opened_file')).toHaveLength(0)
    await expect(panel(page).getByText(/couldn't|failed/i)).toBeHidden()
  })

  test('image and sprite sheet imports open image files only', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')

    await chooseFrom(page, 'Import', /Image/)
    await chooseFrom(page, 'Import', /Sprite sheet/)
    await page.getByRole('dialog', { name: 'Import sprite sheet' }).getByRole('button', { name: 'Choose image' }).click()

    await expect.poll(() => calls(page, 'open_dialog')).toEqual([{ types: [IMAGE_TYPE] }, { types: [IMAGE_TYPE] }])
  })

  test("a sprite sheet that can't be read says so on its field, and a readable one clears it", async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    await chooseFrom(page, 'Import', /Sprite sheet/)
    const sheet = page.getByRole('dialog', { name: 'Import sprite sheet' })

    await setShell(page, { open: { name: 'locked.png', bytes: [], unreadable: true } })
    await sheet.getByRole('button', { name: 'Choose image' }).click()
    await expect(sheet.getByText("Couldn't open that file")).toBeVisible()
    await expect(sheet.getByText('No file chosen')).toBeVisible()

    await setShell(page, { open: { name: 'walk.png', bytes: [1, 2, 3] } })
    await sheet.getByRole('button', { name: 'Choose image' }).click()
    await expect(sheet.getByText('walk.png')).toBeVisible()
    await expect(sheet.getByText("Couldn't open that file")).toBeHidden()
  })

  test('an image picked in the Open window becomes pixels', async ({ page }) => {
    await openTool(page)
    await createProject(page, 'Hero walk')
    const png = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      canvas.getContext('2d')!.fillRect(0, 0, 32, 32)
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    })
    await setShell(page, { open: { name: 'black.png', bytes: png } })

    await chooseFrom(page, 'Import', /Image/)
    await expect(panel(page).getByText('Image imported')).toBeVisible()
  })
})

test.describe('inside the shell, in Spanish', () => {
  test.use({ locale: 'es-ES' })
  test.beforeEach(({ page }) => withFakeShell(page))

  test('the windows name the file types in the tool\'s language', async ({ page }) => {
    await openTool(page, 'Proyecto nuevo')
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Dragón')
    await page.getByRole('button', { name: 'Crear proyecto' }).click()
    await setShell(page, { save: 'cancel' })

    await chooseFrom(page, 'Guardar' as 'Save', /Proyecto/)
    await chooseFrom(page, 'Importar' as 'Import', /Imagen/)

    await expect.poll(() => page.evaluate(() =>
      window.__shell.calls.filter(call => call.command.endsWith('_dialog')).map(call => call.args)
    )).toEqual([
      { suggestedName: 'Dragón.tps', types: [{ description: 'Proyecto de Pixel Stitch', extensions: ['tps', 'json'] }] },
      { types: [{ description: 'Imagen', extensions: IMAGE_TYPE.extensions }] }
    ])
  })
})

// An artist carries work over by saving a project file on the platform and
// importing it into the app. The bundle without a shell runs the web build's
// host, so its Save → Project file writes exactly what the platform writes.
test('a project file saved by the web version imports into the app with its frames, layers and board size', async ({ browser }) => {
  const web = await browser.newPage({ locale: 'en-US' })
  await web.addInitScript((project) => {
    if (!localStorage.getItem('pixel-stitch-projects')) localStorage.setItem('pixel-stitch-project', JSON.stringify(project))
  }, layeredProject())
  await openTool(web, 'New project')
  await expect(tab(web, 'Untitled 1')).toHaveAttribute('aria-selected', 'true')
  await web.getByRole('tab', { name: /^Untitled 1, / }).dblclick()
  await web.getByRole('textbox', { name: 'Project name' }).fill('Knight')
  await web.keyboard.press('Enter')
  await expect(tab(web, 'Knight')).toBeVisible()

  await panel(web).getByRole('button', { name: 'Save' }).click()
  const [download] = await Promise.all([
    web.waitForEvent('download'),
    web.getByRole('menuitem', { name: /Project/ }).click()
  ])
  const saved = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  })
  await web.close()

  const app = await browser.newPage({ locale: 'en-US' })
  await withFakeShell(app)
  await openTool(app)
  await createProject(app, 'Hero walk')
  await setShell(app, { open: { name: download.suggestedFilename(), bytes: Array.from(saved) } })
  await chooseFrom(app, 'Import', /Project/)

  await expect(tab(app, 'Knight')).toHaveAccessibleName('Knight, 16×16')
  // The imported project as the app wrote it to disk.
  const storedProject = async () => {
    const writes = await calls(app, 'storage_write') as { key: string, contents: string }[]
    const write = writes.findLast(entry => entry.key.startsWith('pixel-stitch-project:') && entry.contents.includes('"Outline"'))
    return write ? JSON.parse(write.contents) : null
  }
  await expect.poll(storedProject).not.toBeNull()
  const stored = await storedProject()
  const original = layeredProject()
  expect(stored.canvasSize).toBe(16)
  expect(stored.frames).toHaveLength(2)
  expect(stored.frames.map((frame: { layers: { name: string, opacity: number, data: string[][] }[] }) => frame.layers))
    .toEqual(original.frames.map(frame => frame.layers.map(({ name, opacity, data }) => expect.objectContaining({ name, opacity, data }))))
  await app.close()
})
