import type { InjectionKey } from 'vue'
import { useMelodyLoom } from '~/composables/useMelodyLoom'

export type MelodyLoomEditor = ReturnType<typeof useMelodyLoom>

const MELODY_LOOM_KEY: InjectionKey<MelodyLoomEditor> = Symbol('melody-loom')

/**
 * Every panel acts on the same grid and playhead, so the page provides one
 * editor instance instead of threading it through as props — same shape as
 * Pixel Stitch's `providePixelStitch`/`usePixelStitchContext`.
 */
export function provideMelodyLoom(editor: MelodyLoomEditor) {
  provide(MELODY_LOOM_KEY, editor)
}

export function useMelodyLoomContext(): MelodyLoomEditor {
  const editor = inject(MELODY_LOOM_KEY, null)
  if (!editor) throw new Error('Melody Loom panels must be rendered inside the Melody Loom page')
  return editor
}
