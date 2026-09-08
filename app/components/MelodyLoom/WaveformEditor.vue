<script setup lang="ts">
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'
import { useWaveformEditorContext } from '~/composables/useWaveformEditorContext'

const sequencer = useMelodyLoomContext()
const editor = useWaveformEditorContext()
const { t } = useI18n()

// The waveform composable stays clear of the grid — the render input is
// assembled here, where both halves of the tool are already in scope.
function renderFromSequencer() {
  return editor.loadFromSequence({
    grid: sequencer.grid.value,
    noteDurations: sequencer.noteDurations,
    rowInstruments: sequencer.rowInstruments.value,
    bpm: sequencer.bpm.value,
    volume: sequencer.volume.value,
    reverbAmount: sequencer.reverbAmount.value
  })
}

const errorMessage = computed(() =>
  editor.error.value ? t(`melodyLoom.waveform.errors.${editor.error.value}`) : null
)

const playLabel = computed(() => {
  if (editor.isPlaying.value) return t('melodyLoom.waveform.stop')
  return editor.selection.value ? t('melodyLoom.waveform.playSelection') : t('melodyLoom.waveform.play')
})

const elapsed = computed(() => editor.recordingSeconds.value.toFixed(1))
</script>

<template>
  <section class="flex flex-col gap-2 p-4">
    <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
      {{ t('melodyLoom.waveform.title') }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <UTooltip :text="playLabel">
        <UButton
          :icon="editor.isPlaying.value ? 'lucide:square' : 'lucide:play'"
          color="primary"
          class="h-9 w-9 justify-center rounded-md"
          :disabled="!editor.buffer.value || editor.isRecording.value"
          :aria-label="playLabel"
          @click="editor.togglePlayback()"
        />
      </UTooltip>

      <USeparator orientation="vertical" class="h-8" />

      <UButton
        :label="t('melodyLoom.waveform.import')"
        icon="lucide:folder-open"
        color="neutral"
        variant="outline"
        class="h-9 rounded-md"
        :disabled="editor.isBusy.value || editor.isRecording.value"
        @click="editor.importFile()"
      />
      <UButton
        :label="t('melodyLoom.waveform.fromSequencer')"
        icon="lucide:list-music"
        color="neutral"
        variant="outline"
        class="h-9 rounded-md"
        :loading="editor.isBusy.value"
        :disabled="editor.isRecording.value"
        @click="renderFromSequencer"
      />

      <USeparator orientation="vertical" class="h-8" />

      <template v-if="editor.isRecording.value">
        <UButton
          :label="t('melodyLoom.waveform.stopRecording')"
          icon="lucide:square"
          color="error"
          class="h-9 rounded-md"
          @click="editor.stopRecording()"
        />
        <UButton
          :label="t('melodyLoom.waveform.discardTake')"
          icon="lucide:trash-2"
          color="neutral"
          variant="outline"
          class="h-9 rounded-md"
          @click="editor.cancelRecording()"
        />
        <span class="flex items-center gap-1.5 text-xs tabular-nums text-muted" aria-live="polite">
          <span class="size-2 rounded-full bg-error motion-safe:animate-pulse" />
          {{ t('melodyLoom.waveform.recording', { seconds: elapsed }) }}
        </span>
      </template>
      <UButton
        v-else
        :label="t('melodyLoom.waveform.record')"
        icon="lucide:mic"
        color="error"
        variant="outline"
        class="h-9 rounded-md"
        :disabled="editor.isBusy.value"
        @click="editor.startRecording()"
      />

      <div class="grow" />

      <span v-if="editor.isZoomed.value" class="text-xs tabular-nums text-dimmed">
        {{ t('melodyLoom.waveform.zoomLevel', { zoom: Math.round(editor.zoom.value) }) }}
      </span>
      <UTooltip :text="t('melodyLoom.waveform.fit')">
        <UButton
          icon="lucide:scan"
          color="neutral"
          variant="outline"
          class="h-9 w-9 justify-center rounded-md"
          :disabled="!editor.isZoomed.value"
          :aria-label="t('melodyLoom.waveform.fit')"
          @click="editor.resetView()"
        />
      </UTooltip>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      icon="lucide:triangle-alert"
      :title="errorMessage"
      close
      @update:open="editor.dismissError()"
    />

    <MelodyLoomWaveformCanvas />

    <p class="px-1 text-xs text-dimmed">
      {{ t('melodyLoom.waveform.hint') }}
    </p>
  </section>
</template>
