import { expect, test, type Page } from '@playwright/test'

// Pixel Stitch's file windows once the host seam carries them (issue #38). The
// sprite sheet import window used to hold its own file field; it now asks the
// host's Open for the file, the same way every other import does.

const TOOL = '/make/pixel-stitch'

const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')
const sheetWindow = (page: Page) => page.getByRole('dialog', { name: 'Import sprite sheet' })

async function openToolWithProject(page: Page) {
  await page.goto(TOOL)
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(panel(page).locator('main canvas')).toBeVisible()
}

async function openSheetImport(page: Page) {
  await panel(page).getByRole('button', { name: 'Import' }).click()
  await page.getByRole('menuitem', { name: /Sprite sheet/ }).click()
  await expect(sheetWindow(page)).toBeVisible()
}

/** A 64×32 PNG: two 32×32 frames side by side, red then blue. */
async function twoFrameSheet(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = '#0000FF'
    ctx.fillRect(32, 0, 32, 32)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return Buffer.from(base64, 'base64')
}

test('a sprite sheet is chosen through a button, named, then imported as frames', async ({ page }) => {
  await openToolWithProject(page)
  await openSheetImport(page)

  const window = sheetWindow(page)
  await expect(window.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    window.getByRole('button', { name: 'Choose image' }).click()
  ])
  await chooser.setFiles({ name: 'walk-cycle.png', mimeType: 'image/png', buffer: await twoFrameSheet(page) })
  await expect(window.getByText('walk-cycle.png')).toBeVisible()

  await window.getByRole('spinbutton', { name: 'Columns' }).fill('2')
  await window.getByRole('spinbutton', { name: 'Rows' }).fill('1')
  await window.getByRole('button', { name: 'Import', exact: true }).click()

  await expect(panel(page).getByText('Imported 2 frames from the sprite sheet')).toBeVisible()
})

test('dismissing the sprite sheet picker leaves the window as it was', async ({ page }) => {
  await openToolWithProject(page)
  await openSheetImport(page)

  const window = sheetWindow(page)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    window.getByRole('button', { name: 'Choose image' }).click()
  ])
  await chooser.setFiles([])

  await expect(window.getByRole('button', { name: 'Choose image' })).toBeVisible()
  await expect(window.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
})
