import { createEditorContext } from '~/composables/createEditorContext'
import { useMelodyLoom } from '~/composables/useMelodyLoom'

export type MelodyLoomEditor = ReturnType<typeof useMelodyLoom>

/**
 * Every panel acts on the same grid and playhead, so the page provides one
 * editor instance instead of threading it through as props — same shape as
 * Pixel Stitch's `providePixelStitch`/`usePixelStitchContext`.
 */
const context = createEditorContext<MelodyLoomEditor>(
  'melody-loom',
  'Melody Loom panels must be rendered inside the Melody Loom page'
)

export const provideMelodyLoom = context.provide
export const useMelodyLoomContext = context.use
