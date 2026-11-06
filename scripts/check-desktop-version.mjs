// Fails when a pixel-stitch-v* tag doesn't match the version in package.json,
// which is where tauri.conf.json takes the installers' version from.
// Usage: node scripts/check-desktop-version.mjs <tag> [installer file or folder]...
// With installers, also checks each file name carries that version, so a stale
// file left in the bundle folder can't be released under the new tag.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findInstallers } from './check-installer-size.mjs'

export const TAG_PREFIX = 'pixel-stitch-v'

export function versionFromTag(tag) {
  const name = tag.replace(/^refs\/tags\//, '')
  if (!name.startsWith(TAG_PREFIX)) return null
  return name.slice(TAG_PREFIX.length)
}

export function checkVersion(tag, packageVersion, installers = []) {
  const errors = []
  const tagVersion = versionFromTag(tag)
  if (tagVersion === null) {
    errors.push(`Tag "${tag}" doesn't start with "${TAG_PREFIX}".`)
    return errors
  }
  if (tagVersion !== packageVersion) {
    errors.push(`Tag ${tag} is version ${tagVersion}, but package.json says ${packageVersion}. Bump "version" in package.json to ${tagVersion} (or tag ${TAG_PREFIX}${packageVersion}) and tag again.`)
  }
  for (const file of installers) {
    // Tauri names them <product>_<version>_<arch>-setup.exe / .deb.
    if (!basename(file).includes(`_${tagVersion}_`)) {
      errors.push(`${file} isn't named for version ${tagVersion}.`)
    }
  }
  return errors
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [tag, ...paths] = process.argv.slice(2)
  if (!tag) {
    console.error('Usage: node scripts/check-desktop-version.mjs <tag> [installer file or folder]...')
    process.exit(2)
  }
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const errors = checkVersion(tag, version, paths.length ? findInstallers(paths) : [])
  if (errors.length) {
    for (const error of errors) console.error(error)
    process.exit(1)
  }
  console.log(`Version ${version} matches ${tag}.`)
}
