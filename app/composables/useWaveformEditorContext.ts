import { createEditorContext } from '~/composables/createEditorContext'
import { useWaveformEditor } from '~/composables/useWaveformEditor'

export type WaveformEditor = ReturnType<typeof useWaveformEditor>

/**
 * The canvas, the toolbar and anything later bolted onto the block all act on
 * the same buffer and the same selection, so the page provides one editor
 * instance — same shape as `provideMelodyLoom` for the sequencer half.
 */
const context = createEditorContext<WaveformEditor>(
  'waveform-editor',
  'Waveform panels must be rendered inside the Melody Loom page'
)

export const provideWaveformEditor = context.provide
export const useWaveformEditorContext = context.use
