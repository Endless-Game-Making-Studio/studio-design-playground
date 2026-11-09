import type { FileType, HostStorage, PixelStitchHost } from './host'

/**
 * Calls one of the desktop shell's commands (`src-tauri/src/storage.rs`,
 * `src-tauri/src/files.rs`). Bytes go as the raw body rather than inside JSON,
 * where a GIF would grow to several times its size as a list of numbers.
 */
export type Invoke = <T>(command: string, args?: Record<string, unknown> | Uint8Array) => Promise<T>

/**
 * The shell's command bridge, or null outside the desktop shell. Tauri puts
 * `__TAURI_INTERNALS__` on every page it loads; `@tauri-apps/api`'s `invoke`
 * is a thin wrapper over the same call, so the web build gains no dependency.
 */
export function shellInvoke(): Invoke | null {
  const internals = (window as { __TAURI_INTERNALS__?: { invoke: Invoke } }).__TAURI_INTERNALS__
  return internals ? internals.invoke.bind(internals) : null
}

const REMOVED = Symbol('removed')
type DiskChange = string | typeof REMOVED

/**
 * Storage as one file per key on disk. Everything the page reads comes from
 * memory: `load` fills it from disk, and `write` updates it at once and sends
 * the file to disk in the background.
 */
export function createDiskStorage(invoke: Invoke): HostStorage {
  // Each key's JSON text, or null when nothing is stored under it. A key
  // missing here hasn't been loaded.
  const memory = new Map<string, string | null>()
  const loading = new Map<string, Promise<void>>()

  // Disk changes go out one at a time per key, so two renames over the same
  // file never race. While one is on its way only the newest change waits
  // behind it: an autosave replaces the one before it, so the older one
  // would only be overwritten anyway.
  const waiting = new Map<string, DiskChange>()
  const sending = new Map<string, Promise<void>>()

  // Keys whose last disk write failed. Their writes return false until one
  // reaches disk, which keeps the editor's "couldn't save" notice to once per
  // run of failures: it says it again whenever a write returns true.
  const failed = new Set<string>()
  const failureListeners = new Set<(key: string) => void>()

  async function send(key: string) {
    while (waiting.has(key)) {
      const change = waiting.get(key)!
      waiting.delete(key)
      try {
        if (change === REMOVED) await invoke('storage_remove', { key })
        else await invoke('storage_write', { key, contents: change })
        failed.delete(key)
      } catch (error) {
        console.error(`Pixel Stitch: ${String(error)}`)
        if (change !== REMOVED && !failed.has(key)) {
          failed.add(key)
          for (const listener of failureListeners) listener(key)
        }
      }
    }
    sending.delete(key)
  }

  function queue(key: string, change: DiskChange) {
    waiting.set(key, change)
    if (!sending.has(key)) sending.set(key, send(key))
  }

  async function whenIdle() {
    // A change queued while waiting starts a new send, so look again.
    while (sending.size) await Promise.all(sending.values())
  }

  return {
    kind: 'disk',

    async load(keys) {
      const unread = keys.filter(key => !memory.has(key) && !loading.has(key))
      if (unread.length) {
        const read = invoke<(string | null)[]>('storage_read', { keys: unread })
          .then((values) => {
            // A key written while its file was being read keeps the newer value.
            unread.forEach((key, index) => {
              if (!memory.has(key)) memory.set(key, values[index] ?? null)
            })
          })
          // An unreadable file reads as nothing stored, as a corrupt entry
          // does in the browser.
          .catch(error => console.error(`Pixel Stitch: ${String(error)}`))
          .finally(() => unread.forEach(key => loading.delete(key)))
        for (const key of unread) loading.set(key, read)
      }
      await Promise.all(keys.map(key => loading.get(key)))
    },

    read(key) {
      const text = memory.get(key)
      if (text == null) return null
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    },

    write(key, value) {
      // Indented, the way Save → Project file writes a project, so a project's
      // file on disk can be imported as one.
      const text = JSON.stringify(value, null, 2)
      memory.set(key, text)
      queue(key, text)
      return !failed.has(key)
    },

    remove(key) {
      memory.set(key, null)
      queue(key, REMOVED)
    },

    onWriteFailed(listener) {
      failureListeners.add(listener)
      return () => failureListeners.delete(listener)
    },

    whenIdle,

    async flush() {
      // A key that failed may have nothing new to write since, so its last
      // value is sent again from memory: the disk may have room by now.
      for (const key of failed) {
        const text = memory.get(key)
        if (typeof text === 'string' && !waiting.has(key)) queue(key, text)
      }
      await whenIdle()
      return failed.size === 0
    }
  }
}

// What the system's windows need from a file type: the filter's name and its
// extensions. MIME types are a browser matter.
const dialogTypes = (types: FileType[]) => types.map(({ description, extensions }) => ({ description, extensions }))

// A picked file comes back as bare bytes. Images are read through a data URL,
// which carries this type, the way a file from the browser's input carries
// the type the browser gave it.
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tps: 'application/json',
  json: 'application/json'
}
const typeOf = (name: string) => TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? ''

/**
 * The host inside the desktop shell: projects as files on disk, and the
 * system's own Save and Open windows.
 *
 * The page never sees or names a path. The shell opens the window, keeps the
 * place the person chose, and the next command reads or writes that one file,
 * so the page can only touch files the person picked themselves.
 */
export function createDesktopHost(invoke: Invoke): PixelStitchHost {
  return {
    storage: createDiskStorage(invoke),

    async saveFile({ data, suggestedName, types }) {
      const chosen = await invoke<boolean>('save_dialog', { suggestedName, types: dialogTypes(types) })
      if (!chosen) return false
      await invoke('write_saved_file', new Uint8Array(await data.arrayBuffer()))
      return true
    },

    async openFile({ types }) {
      const name = await invoke<string | null>('open_dialog', { types: dialogTypes(types) })
      if (name == null) return null
      const bytes = await invoke<ArrayBuffer>('read_opened_file')
      return { name, data: new Blob([bytes], { type: typeOf(name) }) }
    }
  }
}
