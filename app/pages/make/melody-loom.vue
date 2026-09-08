<script setup lang="ts">
import { installAudioUnlock, getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { useMelodyLoom } from '~/composables/useMelodyLoom'
import { provideMelodyLoom } from '~/composables/useMelodyLoomContext'
import { useWaveformEditor } from '~/composables/useWaveformEditor'
import { provideWaveformEditor } from '~/composables/useWaveformEditorContext'

definePageMeta({ layout: 'tool' })

const { t } = useI18n()
useHead({ title: () => t('melodyLoom.title') })

const editor = useMelodyLoom()
provideMelodyLoom(editor)

const waveform = useWaveformEditor()
provideWaveformEditor(waveform)

// The context is created here, on first gesture, rather than at module scope —
// `getSharedAudioContext` throws during SSR, and iOS/Safari won't make sound
// out of it until a real user gesture unlocks it (see melodyLoom/audioContext.ts).
let disposeUnlock: (() => void) | null = null

onMounted(() => {
  disposeUnlock = installAudioUnlock(getSharedAudioContext())
})

onBeforeUnmount(() => {
  disposeUnlock?.()
  disposeUnlock = null
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <MelodyLoomControlPanel />
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <MelodyLoomSequencerGrid />
      <USeparator />
      <MelodyLoomWaveformEditor />
    </div>
  </div>
</template>
