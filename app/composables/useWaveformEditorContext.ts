import type { InjectionKey } from 'vue'
import { useWaveformEditor } from '~/composables/useWaveformEditor'

export type WaveformEditor = ReturnType<typeof useWaveformEditor>

const WAVEFORM_EDITOR_KEY: InjectionKey<WaveformEditor> = Symbol('waveform-editor')

/**
 * The canvas, the toolbar and anything later bolted onto the block all act on
 * the same buffer and the same selection, so the page provides one editor
 * instance — same shape as `provideMelodyLoom` for the sequencer half.
 */
export function provideWaveformEditor(editor: WaveformEditor) {
  provide(WAVEFORM_EDITOR_KEY, editor)
}

export function useWaveformEditorContext(): WaveformEditor {
  const editor = inject(WAVEFORM_EDITOR_KEY, null)
  if (!editor) throw new Error('Waveform panels must be rendered inside the Melody Loom page')
  return editor
}
