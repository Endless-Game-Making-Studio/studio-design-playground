import type { FileType, PixelStitchHost } from './host'
import { downloadBlob, pickFile } from '~/composables/files'

// The browser's file input takes one comma-separated `accept` list mixing MIME
// types and dotted extensions.
function acceptList(types: FileType[]) {
  return types
    .flatMap(type => [...(type.mimeTypes ?? []), ...type.extensions.map(extension => `.${extension}`)])
    .join(',')
}

/**
 * The host the web build runs on: browser storage, a download link and a file
 * input. Storage is synchronous already, so there is nothing to load ahead of
 * time and no write can fail after it returned.
 */
export const browserHost: PixelStitchHost = {
  storage: {
    kind: 'browser',

    load: () => Promise.resolve(),

    read(key) {
      if (!import.meta.client) return null
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },

    // Quota exceeded is the realistic failure: several 128×128 projects with a
    // handful of frames add up to megabytes.
    write(key, value) {
      if (!import.meta.client) return true
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch {
        return false
      }
    },

    remove(key) {
      if (import.meta.client) localStorage.removeItem(key)
    },

    onWriteFailed: () => () => {},

    // Writes either land at once or return false, which the caller has
    // already told the person about. There is nothing to try again.
    flush: () => Promise.resolve(true),

    whenIdle: () => Promise.resolve()
  },

  // A download can't be cancelled from the page's side and gives no answer
  // back, so handing it to the browser counts as saved.
  saveFile({ data, suggestedName }) {
    downloadBlob(data, suggestedName)
    return Promise.resolve(true)
  },

  async openFile({ types }) {
    const file = await pickFile(acceptList(types))
    return file ? { name: file.name, data: file } : null
  }
}
