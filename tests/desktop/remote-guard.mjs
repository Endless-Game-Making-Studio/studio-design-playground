import { appendFileSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { connect } from 'node:net'

// The desktop bundle must never reach past the machine. Every browser in the
// desktop runs is pointed at this proxy, which refuses anything bound for a
// remote origin and writes it down; the global teardown then fails the run if
// the list isn't empty. A proxy, rather than a fixture, so the existing web
// spec runs against the bundle without being edited.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function startRemoteGuard(logFile, port) {
  writeFileSync(logFile, '')
  const record = (target) => appendFileSync(logFile, `${target}\n`)

  const server = createServer((req, res) => {
    req.on('error', () => res.destroy())
    res.on('error', () => {})
    const url = new URL(req.url)
    if (!LOOPBACK.has(url.hostname)) {
      record(req.url)
      res.writeHead(403).end()
      return
    }
    // Browsers that don't honour the proxy bypass list still send the app's
    // own requests here, so loopback traffic is passed through untouched.
    const upstream = request(url, { method: req.method, headers: req.headers }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    })
    upstream.on('error', () => res.headersSent ? res.destroy() : res.writeHead(502).end())
    req.pipe(upstream)
  })

  // A browser closing a tab mid-request resets its sockets; that must not take
  // the whole run down with it.
  server.on('clientError', (_error, socket) => socket.destroy())
  server.on('connect', (req, socket) => {
    socket.on('error', () => socket.destroy())
    const [host, port] = req.url.split(/:(?=\d+$)/)
    if (!LOOPBACK.has(host)) {
      record(`https://${req.url}`)
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    const upstream = connect(Number(port), host, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      upstream.pipe(socket)
      socket.pipe(upstream)
    })
    upstream.on('error', () => socket.destroy())
    socket.on('close', () => upstream.destroy())
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
