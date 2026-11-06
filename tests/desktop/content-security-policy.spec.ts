import { expect, test, type Page } from '@playwright/test'
import { setShell, withFakeShell } from './fakeShell'

// The desktop bundle under the shell's content security policy (issue #43).
// The desktop runs serve every page with the policy from tauri.conf.json
// (scripts/serve-static.mjs --csp), so this walks through what the tool does
// beyond drawing — fonts, icons, Nuxt UI's runtime styles, every export and
// import — and expects the policy to have refused nothing.

declare global {
  interface Window {
    __violations: string[]
  }
}

const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')

async function chooseFrom(page: Page, menu: 'Save' | 'Import', item: RegExp) {
  await panel(page).getByRole('button', { name: menu }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

function twoFrameProject() {
  const grid = (colour: string) => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => colour))
  return {
    version: 1,
    canvasSize: 16,
    fps: 6,
    currentFrameIndex: 0,
    frames: ['#FF0000', '#0000FF'].map((colour, index) => ({
      id: index + 1,
      layers: [{ id: 1, name: 'Layer 1', opacity: 1, data: grid(colour) }]
    }))
  }
}

test.use({ locale: 'en-US' })

test('the tool runs under the shell\'s policy without anything refused', async ({ page }) => {
  await page.addInitScript(() => {
    window.__violations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  await withFakeShell(page)

  const response = await page.goto('/')
  expect(await response!.headerValue('content-security-policy')).toContain('default-src \'self\'')
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Create project' }).click()
  await panel(page).locator('main canvas').click({ position: { x: 20, y: 20 } })

  await chooseFrom(page, 'Save', /Project/)
  await expect(panel(page).getByText('Project saved')).toBeVisible()
  await chooseFrom(page, 'Save', /PNG/)
  await expect(panel(page).getByText('Frame exported')).toBeVisible()
  await chooseFrom(page, 'Save', /Sprite sheet/)
  await page.getByRole('dialog', { name: 'Export sprite sheet' }).getByRole('button', { name: 'Export' }).click()
  await expect(panel(page).getByText('Sprite sheet exported')).toBeVisible()

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

  await setShell(page, { open: { name: 'walk.tps', bytes: Array.from(Buffer.from(JSON.stringify(twoFrameProject()))) } })
  await chooseFrom(page, 'Import', /Project/)
  await expect(page.getByRole('tab', { name: /^walk, / })).toHaveAttribute('aria-selected', 'true')
  await chooseFrom(page, 'Save', /GIF/)
  await expect(panel(page).getByText('GIF exported')).toBeVisible({ timeout: 20_000 })

  expect(await page.evaluate(() => window.__violations)).toEqual([])
})
