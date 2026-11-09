import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

// Serves a built static bundle the way the desktop shell will load it: plain
// files, nothing rendered on request. Unknown paths fall back to the SPA
// shell, like a reload on a client-side route would.
//   node scripts/serve-static.mjs <dir> <port> [--csp <tauri.conf.json>]
//
// With --csp, every page carries the shell's content security policy, so the
// bundle is tested under the policy it ships with. Tauri adds a hash of each
// inline script in the HTML to script-src when it embeds the bundle
// (dangerousDisableAssetCspModification turns that off per directive), and so
// does this server.

const root = resolve(process.argv[2] ?? '.output-desktop/public')
const port = Number(process.argv[3] ?? 4173)
const cspConfig = process.argv.indexOf('--csp') > 0 ? process.argv[process.argv.indexOf('--csp') + 1] : null

function contentSecurityPolicy(html) {
  const { security } = JSON.parse(readFileSync(cspConfig, 'utf8')).app
  const directives = Object.fromEntries(Object.entries(security.csp).map(([name, sources]) => [name, sources.split(' ')]))
  const untouched = security.dangerousDisableAssetCspModification ?? []
  if (untouched !== true && !untouched.includes('script-src')) {
    for (const [, attributes, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      // A data block isn't run, so it needs no hash.
      if (/\ssrc=/.test(attributes) || /type="application\/json"/.test(attributes)) continue
      directives['script-src'].push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
    }
  }
  return Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ')
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
}

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No index.html in ${root}. Build it first: npm run build:desktop`)
  process.exit(1)
}

createServer((req, res) => {
  res.on('error', () => {})
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  let file = join(root, normalize(pathname))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const index = join(file, 'index.html')
    file = existsSync(index) ? index : join(root, 'index.html')
  }
  const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream' }
  if (cspConfig && extname(file) === '.html') {
    const html = readFileSync(file, 'utf8')
    res.writeHead(200, { ...headers, 'content-security-policy': contentSecurityPolicy(html) }).end(html)
    return
  }
  res.writeHead(200, headers)
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://localhost:${port}`)
})
