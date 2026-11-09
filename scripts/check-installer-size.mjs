// Fails when a Pixel Stitch installer that has a size budget is over it.
// Usage: node scripts/check-installer-size.mjs <file or folder>...
// Folders are searched recursively for the budgeted kinds (the NSIS setup .exe,
// the portable .exe and the .deb). The AppImage carries its own WebKitGTK and
// is exempt.
import { readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// MiB, so the limit matches the size Windows Explorer and `ls -lh` show.
export const BUDGET_BYTES = 15 * 1024 * 1024

export function isBudgeted(file) {
  const name = basename(file).toLowerCase()
  return name.endsWith('-setup.exe') || name.endsWith('-portable.exe') || name.endsWith('.deb')
}

export function findInstallers(paths) {
  const found = []
  const walk = (path) => {
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry))
    } else if (isBudgeted(path)) {
      found.push(path)
    }
  }
  for (const path of paths) walk(path)
  return found
}

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// Returns one line per file and whether all of them are within the budget.
export function checkSizes(files, budget = BUDGET_BYTES) {
  const lines = []
  let ok = true
  for (const file of files) {
    const size = statSync(file).size
    if (size > budget) {
      ok = false
      lines.push(`FAIL ${file}: ${mb(size)}, ${mb(size - budget)} (${size - budget} bytes) over the ${mb(budget)} budget`)
    } else {
      lines.push(`ok   ${file}: ${mb(size)} (${mb(budget - size)} under the ${mb(budget)} budget)`)
    }
  }
  return { ok, lines }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const paths = process.argv.slice(2)
  if (paths.length === 0) {
    console.error('Usage: node scripts/check-installer-size.mjs <file or folder>...')
    process.exit(2)
  }
  const files = findInstallers(paths)
  // A wrong path or a renamed bundle would otherwise pass with nothing checked.
  if (files.length === 0) {
    console.error(`No setup .exe, portable .exe or .deb found under: ${paths.join(', ')}`)
    process.exit(1)
  }
  const { ok, lines } = checkSizes(files)
  for (const line of lines) (ok ? console.log : console.error)(line)
  process.exit(ok ? 0 : 1)
}
