import { browserHost } from './browserHost'

/**
 * One kind of file a save or open window offers. A native dialog shows
 * `description` as the filter name and matches on `extensions` (without the
 * dot). The browser's file input also takes `mimeTypes`, so an image filter can
 * say `image/*` instead of listing every extension a browser can decode.
 */
export interface FileType {
  description: string
  extensions: string[]
  mimeTypes?: string[]
}

/** A file the person picked: its name as they see it, and its contents. */
export interface OpenedFile {
  name: string
  data: Blob
}

/**
 * Key-value storage for what Pixel Stitch keeps between visits: the projects
 * list, the workspace, the palette and one entry per project. Values are plain
 * JSON values; how they are serialised is the host's business.
 *
 * Reads and writes are synchronous because the editor autosaves from watchers
 * and restores in `onMounted`. A host whose real storage is asynchronous (files
 * on disk) keeps a copy in memory: `load` fills it ahead of the reads, and
 * `write` updates it at once and reaches the real storage in the background.
 */
export interface HostStorage {
  /**
   * Where the values end up, so a failed save can be explained in the
   * person's terms: a full browser storage, or a disk that refused the file.
   */
  kind: 'browser' | 'disk'
  /**
   * Makes these keys readable synchronously. Callers await it before the first
   * render (the base keys and every open tab's project) and before a closed
   * project's tab mounts. A key with nothing stored is not an error.
   */
  load(keys: string[]): Promise<void>
  /** The stored value, or null when there is none or it can't be read. */
  read(key: string): unknown
  /**
   * Whether the write was accepted. False means it is known not to have landed
   * (the browser's storage is full); callers tell the person.
   */
  write(key: string, value: unknown): boolean
  remove(key: string): void
  /**
   * Reports a write that returned true but failed afterwards, such as a disk
   * write that finished in the background. Returns the unsubscribe.
   */
  onWriteFailed(listener: (key: string) => void): () => void
  /**
   * Resolves once every write and remove made so far has reached the real
   * storage, failed ones included (those are reported through
   * `onWriteFailed`). Quitting waits on it, so the last stroke isn't lost.
   */
  whenIdle(): Promise<void>
}

export interface PixelStitchHost {
  storage: HostStorage
  /**
   * Offers the bytes to the person as a file. Resolves to whether it was
   * saved; a cancelled window resolves to false and is not an error.
   */
  saveFile(options: { data: Blob, suggestedName: string, types: FileType[] }): Promise<boolean>
  /** Asks the person for one file. Resolves to null when they cancel. */
  openFile(options: { types: FileType[] }): Promise<OpenedFile | null>
}

// A plain module variable rather than `useState`: the host is fixed for the
// whole run and has to be reachable from code that runs outside a component's
// setup, such as the persistence module.
let current: PixelStitchHost = browserHost

/**
 * Picks the host for this run. Called once at startup, before Pixel Stitch
 * renders, by whatever build wraps the tool (a desktop shell's plugin, say).
 * The web build never calls it and stays on the browser host.
 */
export function setPixelStitchHost(host: PixelStitchHost) {
  current = host
}

export function usePixelStitchHost(): PixelStitchHost {
  return current
}
