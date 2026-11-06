import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The desktop start screen's language control and version (issue #44). On
// first run the language follows the system's, which the WebView reports as
// the browser's locale; once picked on the start screen, the choice sticks.

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }

async function openTool(page: Page, newProject: string) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: newProject })).toBeVisible({ timeout: 30_000 })
}

test.describe('with an English system language', () => {
  test.use({ locale: 'en-US' })

  test('the tool starts in English', async ({ page }) => {
    await openTool(page, 'New project')
    await expect(page.getByRole('heading', { level: 1, name: 'New project' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveText(/English/)
  })

  test('switching the language changes the whole tool at once', async ({ page }) => {
    await openTool(page, 'New project')

    await page.getByRole('combobox', { name: 'Language' }).click()
    await page.getByRole('option', { name: 'Español' }).click()

    // The start screen, the tab bar and the button labels all switch together.
    await expect(page.getByRole('heading', { level: 1, name: 'Proyecto nuevo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Proyecto nuevo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Crear proyecto' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveText(/Español/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })

  test('the choice survives a relaunch and wins over the system language', async ({ page }) => {
    await openTool(page, 'New project')
    await page.getByRole('combobox', { name: 'Language' }).click()
    await page.getByRole('option', { name: 'Español' }).click()
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toBeVisible()

    await page.reload()
    await openTool(page, 'Proyecto nuevo')
    await expect(page.getByRole('heading', { level: 1, name: 'Proyecto nuevo' })).toBeVisible()
  })

  test('the language control can be used from the keyboard', async ({ page }) => {
    await openTool(page, 'New project')
    const control = page.getByRole('combobox', { name: 'Language' })
    await control.focus()
    await expect(control).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('option', { name: 'Español' }).press('Enter')
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveText(/Español/)
  })

  test('the start screen shows the version the build was made with', async ({ page }) => {
    await openTool(page, 'New project')
    await expect(page.getByText(`Version ${version}`)).toBeVisible()
  })
})

test.describe('with a Spanish system language', () => {
  test.use({ locale: 'es-ES' })

  test('the tool starts in Spanish', async ({ page }) => {
    await openTool(page, 'Proyecto nuevo')
    await expect(page.getByRole('heading', { level: 1, name: 'Proyecto nuevo' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveText(/Español/)
    await expect(page.getByText(`Versión ${version}`)).toBeVisible()
  })
})

test.describe('with another system language', () => {
  test.use({ locale: 'fr-FR' })

  test('the tool starts in English', async ({ page }) => {
    await openTool(page, 'New project')
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveText(/English/)
  })
})
