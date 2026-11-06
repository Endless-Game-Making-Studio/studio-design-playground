import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// The language control and the version belong to the desktop start screen only
// (issue #44). On the web the language lives in the account menu, as before.

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }

test('the web start screen has no language control and no version', async ({ page }) => {
  await page.goto('/make/pixel-stitch')
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible()

  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveCount(0)
  await expect(page.getByText(`Version ${version}`)).toHaveCount(0)
})
