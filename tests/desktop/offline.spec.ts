import { expect, test, type Page } from '@playwright/test'

// The desktop bundle with the network cut off (issue #39). The config already
// sends every request through a proxy that refuses remote origins, so anything
// that still renders here came from the bundle itself.

const isLocal = (url: string) => {
  const { protocol, hostname } = new URL(url)
  return protocol === 'data:' || protocol === 'blob:' || ['localhost', '127.0.0.1'].includes(hostname)
}

async function openTool(page: Page) {
  const remote: string[] = []
  page.on('request', (request) => {
    if (!isLocal(request.url())) remote.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible({ timeout: 30_000 })
  return remote
}

/**
 * Every icon on the page has its glyph. @nuxt/icon draws an icon as a span
 * masked with the glyph's SVG; an icon it couldn't get has no mask, and so
 * nothing on screen.
 */
async function expectIconsRendered(page: Page) {
  const icons = await page.locator('.iconify').evaluateAll(elements => elements
    .filter(element => (element as HTMLElement).offsetParent !== null)
    .map((element) => {
      const style = getComputedStyle(element)
      const mask = style.maskImage || style.webkitMaskImage
      const isSvg = element.tagName.toLowerCase() === 'svg' && element.childElementCount > 0
      return { name: element.className.toString(), drawn: isSvg || (mask !== '' && mask !== 'none') }
    }))
  expect(icons.length).toBeGreaterThan(0)
  expect(icons.filter(icon => !icon.drawn).map(icon => icon.name)).toEqual([])
}

test('the root shows Pixel Stitch on its own, with no platform chrome', async ({ page }) => {
  await openTool(page)

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Endless Studios' })).toHaveCount(0)
  await expect(page.getByRole('link')).toHaveCount(0)
  await expect(page.getByText(/preview as/i)).toHaveCount(0)
})

test('the bundle asks for nothing beyond the machine', async ({ page }) => {
  const remote = await openTool(page)
  await page.getByRole('textbox', { name: 'Name' }).fill('Offline')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.locator('[role="tabpanel"]:visible main canvas')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  expect(remote).toEqual([])
})

test('every icon renders, in the tool and inside menus and modals', async ({ page }) => {
  await openTool(page)
  await expectIconsRendered(page)

  await page.getByRole('textbox', { name: 'Name' }).fill('Icons')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.locator('[role="tabpanel"]:visible main canvas')).toBeVisible()
  await expectIconsRendered(page)

  // Menus: Pixel Stitch's own item icons, plus Nuxt UI's.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expectIconsRendered(page)

  // A modal with Nuxt UI's own close button.
  await page.getByRole('menuitem', { name: /Sprite sheet/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectIconsRendered(page)
})

test('headings render in Figtree and body text in Inter', async ({ page }) => {
  await openTool(page)
  await page.evaluate(() => document.fonts.ready)

  const fonts = await page.evaluate(() => {
    const loaded = [...document.fonts]
      .filter(face => face.status === 'loaded')
      .map(face => face.family.replace(/["']/g, ''))
    const first = (element: Element | null) => element ? getComputedStyle(element).fontFamily.split(',')[0]!.replace(/["']/g, '').trim() : null
    return {
      loaded,
      heading: first(document.querySelector('h1')),
      body: first(document.querySelector('[role="tabpanel"] p'))
    }
  })

  expect(fonts.heading).toBe('Figtree')
  expect(fonts.body).toBe('Inter')
  expect(fonts.loaded).toContain('Figtree')
  expect(fonts.loaded).toContain('Inter')
})
