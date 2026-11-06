import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

// Serves a built static bundle the way the desktop shell will load it: plain
// files, nothing rendered on request. Unknown paths fall back to the SPA
// shell, like a reload on a client-side route would.
//   node scripts/serve-static.mjs <dir> <port>

const root = resolve(process.argv[2] ?? '.output-desktop/public')
const port = Number(process.argv[3] ?? 4173)

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
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://localhost:${port}`)
})
