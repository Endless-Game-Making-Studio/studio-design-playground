import type { Page } from '@playwright/test'

// A stand-in for the desktop shell in a plain browser: an init script puts a
// fake `__TAURI_INTERNALS__` on the page, which makes the bundle pick its
// desktop host, and answers the shell's commands from memory.

export interface ShellCall {
  command: string
  args: unknown
}

export interface FakeShell {
  /**
   * What the next Save window does: pick a place, be cancelled, or pick a
   * place the file then can't be written to.
   */
  save: 'save' | 'cancel' | 'unwritable'
  /**
   * The file the next Open window picks, or null to cancel it. `unreadable`
   * picks a file that then can't be read.
   */
  open: { name: string, bytes: number[], unreadable?: boolean } | null
}

declare global {
  interface Window {
    __shell: FakeShell & { calls: ShellCall[], written: number[][] }
  }
}

export async function withFakeShell(page: Page) {
  await page.addInitScript(() => {
    const storage = new Map<string, string>()
    let opened: { bytes: number[], unreadable?: boolean } | null = null
    const shell: Window['__shell'] = { save: 'save', open: null, calls: [], written: [] }
    window.__shell = shell

    const invoke = async (command: string, args?: unknown) => {
      // The raw body arrives as bytes; keep a plain copy so the test can read it.
      const recorded = args instanceof Uint8Array || args instanceof ArrayBuffer
        ? Array.from(new Uint8Array(args as ArrayBuffer))
        : JSON.parse(JSON.stringify(args ?? null))
      shell.calls.push({ command, args: recorded })
      const named = (args ?? {}) as Record<string, unknown>
      switch (command) {
        case 'storage_read':
          return (named.keys as string[]).map(key => storage.get(key) ?? null)
        case 'storage_write':
          storage.set(named.key as string, named.contents as string)
          return null
        case 'storage_remove':
          storage.delete(named.key as string)
          return null
        case 'save_dialog':
          return shell.save !== 'cancel'
        case 'write_saved_file':
          if (shell.save === 'unwritable') throw new Error('could not write: Access is denied. (os error 5)')
          shell.written.push(recorded as number[])
          return null
        case 'open_dialog':
          opened = shell.open
          return shell.open?.name ?? null
        case 'read_opened_file':
          if (opened?.unreadable) throw new Error('could not read: The process cannot access the file. (os error 32)')
          return new Uint8Array(opened?.bytes ?? []).buffer
        default:
          throw new Error(`unknown command ${command}`)
      }
    }
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: { invoke } })
  })
}

export const calls = (page: Page, command: string) =>
  page.evaluate(name => window.__shell.calls.filter(call => call.command === name).map(call => call.args), command)

export const setShell = (page: Page, shell: Partial<FakeShell>) =>
  page.evaluate(next => Object.assign(window.__shell, next), shell)

