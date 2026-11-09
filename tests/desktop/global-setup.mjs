import { readFileSync } from 'node:fs'
import { startRemoteGuard } from './remote-guard.mjs'

export default async function globalSetup(config) {
  const { logFile, port } = config.metadata.remoteGuard
  const server = await startRemoteGuard(logFile, port)

  return async () => {
    server.close()
    const blocked = readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
    if (blocked.length > 0) {
      throw new Error(`The desktop bundle tried to reach a remote origin:\n${[...new Set(blocked)].join('\n')}`)
    }
  }
}
