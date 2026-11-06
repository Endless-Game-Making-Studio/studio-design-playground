import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

// What the storage and close specs share: finding a project's tab and board,
// counting painted pixels on screen and on disk, and making the disk refuse
// writes.

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${escapeRegExp(name)}, `) })
export const panel = (page: Page) => page.locator('[role="tabpanel"]:visible')
export const canvas = (page: Page) => panel(page).locator('main canvas')

export async function createProject(page: Page, name: string) {
  await expect(page.getByRole('button', { name: /^(New project|Proyecto nuevo)$/ })).toBeVisible()
  if (await page.getByRole('textbox', { name: /^(Name|Nombre)$/ }).count() === 0) {
    await page.getByRole('button', { name: /^(New project|Proyecto nuevo)$/ }).click()
  }
  await page.getByRole('textbox', { name: /^(Name|Nombre)$/ }).fill(name)
  await page.getByRole('button', { name: /^(Create project|Crear proyecto)$/ }).click()
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true')
}

/** Magenta (the default colour) pixels on the visible artboard. */
export function paintedOnScreen(page: Page) {
  return canvas(page).evaluate((element: HTMLCanvasElement) => {
    const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 255) count++
    }
    return count
  })
}

export interface StoredProject {
  canvasSize: number
  frames: { layers: { data: string[][] }[] }[]
}

export const paintedIn = (project: StoredProject) =>
  project.frames.flatMap(frame => frame.layers.flatMap(layer => layer.data.flat())).filter(Boolean).length

/** Painted pixels in a project file, or -1 while it is missing or half written. */
export function paintedInFile(path: string) {
  try {
    return paintedIn(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return -1
  }
}

// Windows ignores a folder's read-only flag, so the folder refuses new files
// through its permissions instead: everyone is denied writing into it.
export function denyWrites(dir: string) {
  const result = spawnSync('icacls', [dir, '/deny', '*S-1-1-0:(OI)(CI)(W,D)'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`icacls failed: ${result.stdout}${result.stderr}`)
}

export function allowWrites(dir: string) {
  if (existsSync(dir)) spawnSync('icacls', [dir, '/remove:d', '*S-1-1-0'])
}
