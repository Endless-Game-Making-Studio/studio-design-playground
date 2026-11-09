// node --test scripts/desktop-release-checks.test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { checkSizes, findInstallers } from './check-installer-size.mjs'
import { checkVersion, versionFromTag } from './check-desktop-version.mjs'

const dir = mkdtempSync(join(tmpdir(), 'pixel-stitch-release-'))
after(() => rmSync(dir, { recursive: true, force: true }))

const file = (path, bytes) => {
  const full = join(dir, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, Buffer.alloc(bytes))
  return full
}

test('finds the setup exe, the portable exe and the deb, and skips the AppImage and the rest', () => {
  const exe = file('nsis/Pixel Stitch_0.1.0_x64-setup.exe', 10)
  const portable = file('portable/Pixel Stitch_0.1.0_x64-portable.exe', 10)
  const deb = file('deb/Pixel Stitch_0.1.0_amd64.deb', 10)
  file('appimage/Pixel Stitch_0.1.0_amd64.AppImage', 10)
  file('rpm/Pixel Stitch-0.1.0-1.x86_64.rpm', 10)
  file('nsis/pixel-stitch.exe', 10)
  assert.deepEqual(findInstallers([dir]).sort(), [deb, exe, portable].sort())
})

test('passes at the budget and fails one byte over, naming the file and the excess', () => {
  const atBudget = file('at.deb', 100)
  const over = file('over-setup.exe', 101)
  assert.equal(checkSizes([atBudget], 100).ok, true)
  const { ok, lines } = checkSizes([atBudget, over], 100)
  assert.equal(ok, false)
  assert.match(lines[1], /^FAIL .*over-setup\.exe: .*\(1 bytes\) over/)
})

test('reads the version from a pixel-stitch tag', () => {
  assert.equal(versionFromTag('pixel-stitch-v1.2.3'), '1.2.3')
  assert.equal(versionFromTag('refs/tags/pixel-stitch-v1.2.3'), '1.2.3')
  assert.equal(versionFromTag('v1.2.3'), null)
})

test('fails when the tag and package.json disagree, saying both versions', () => {
  assert.deepEqual(checkVersion('pixel-stitch-v0.1.0', '0.1.0'), [])
  const [error] = checkVersion('pixel-stitch-v0.2.0', '0.1.0')
  assert.match(error, /0\.2\.0.*package\.json says 0\.1\.0/)
})

test('fails when an installer is named for another version', () => {
  const errors = checkVersion('pixel-stitch-v0.1.0', '0.1.0', [
    'Pixel Stitch_0.1.0_x64-setup.exe',
    'Pixel Stitch_0.0.9_amd64.deb',
  ])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /0\.0\.9_amd64\.deb/)
})
