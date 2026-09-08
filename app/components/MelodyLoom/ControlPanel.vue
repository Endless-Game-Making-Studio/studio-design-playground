<script setup lang="ts">
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'
import { renderSequenceToBuffer } from '~/composables/melodyLoom/offlineRender'
import { encodeWav } from '~/composables/melodyLoom/wavEncoder'
import { downloadBlob } from '~/composables/files'

const editor = useMelodyLoomContext()
const { t } = useI18n()

function togglePlayback() {
  if (editor.isPlaying.value) editor.pause()
  else editor.play()
}

const isExporting = ref(false)

// The render takes the tempo, volume and reverb as they stand when it starts,
// so the button stays busy until it finishes — a second click mid-render would
// otherwise hand back a second file recorded at different settings.
async function exportWav() {
  if (!editor.hasNotes.value || isExporting.value) return
  isExporting.value = true
  try {
    const buffer = await renderSequenceToBuffer({
      grid: editor.grid.value,
      noteDurations: editor.noteDurations,
      rowInstruments: editor.rowInstruments.value,
      bpm: editor.bpm.value,
      volume: editor.volume.value,
      reverbAmount: editor.reverbAmount.value
    })
    downloadBlob(encodeWav(buffer), 'melody-loom-sequence.wav')
  } finally {
    isExporting.value = false
  }
}

const volumePercent = computed({
  get: () => Math.round(editor.volume.value * 100),
  set: (value: number) => (editor.volume.value = value / 100)
})
const reverbPercent = computed({
  get: () => Math.round(editor.reverbAmount.value * 100),
  set: (value: number) => (editor.reverbAmount.value = value / 100)
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-4 border-b border-default bg-default px-4 py-3">
    <div class="flex items-center gap-1.5">
      <UTooltip :text="editor.isPlaying.value ? t('melodyLoom.controls.pause') : t('melodyLoom.controls.play')">
        <UButton
          :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
          color="primary"
          class="h-9 w-9 justify-center rounded-md"
          :aria-label="editor.isPlaying.value ? t('melodyLoom.controls.pause') : t('melodyLoom.controls.play')"
          @click="togglePlayback"
        />
      </UTooltip>
      <UTooltip :text="t('melodyLoom.controls.stop')">
        <UButton
          icon="lucide:square"
          color="neutral"
          variant="outline"
          class="h-9 w-9 justify-center rounded-md"
          :aria-label="t('melodyLoom.controls.stop')"
          @click="editor.stop()"
        />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-8" />

    <div class="flex w-40 flex-col gap-1">
      <div class="flex items-center justify-between text-xs text-muted">
        <span>{{ t('melodyLoom.controls.bpm') }}</span>
        <span class="font-semibold tabular-nums text-highlighted">{{ editor.bpm.value }}</span>
      </div>
      <USlider
        v-model="editor.bpm.value"
        :min="60"
        :max="200"
        :step="1"
        size="sm"
        :aria-label="t('melodyLoom.controls.bpm')"
      />
    </div>

    <div class="flex w-32 flex-col gap-1">
      <div class="flex items-center justify-between text-xs text-muted">
        <span>{{ t('melodyLoom.controls.volume') }}</span>
        <span class="font-semibold tabular-nums text-highlighted">{{ volumePercent }}%</span>
      </div>
      <USlider
        v-model="volumePercent"
        :min="0"
        :max="100"
        :step="5"
        size="sm"
        :aria-label="t('melodyLoom.controls.volume')"
      />
    </div>

    <div class="flex w-32 flex-col gap-1">
      <div class="flex items-center justify-between text-xs text-muted">
        <span>{{ t('melodyLoom.controls.reverb') }}</span>
        <span class="font-semibold tabular-nums text-highlighted">{{ reverbPercent }}%</span>
      </div>
      <USlider
        v-model="reverbPercent"
        :min="0"
        :max="100"
        :step="5"
        size="sm"
        :aria-label="t('melodyLoom.controls.reverb')"
      />
    </div>

    <USeparator orientation="vertical" class="h-8" />

    <UTooltip :text="t('melodyLoom.controls.deleteMode')">
      <UButton
        icon="lucide:eraser"
        color="neutral"
        :variant="editor.isDeleteMode.value ? 'subtle' : 'outline'"
        class="h-9 w-9 justify-center rounded-md"
        :aria-label="t('melodyLoom.controls.deleteMode')"
        :aria-pressed="editor.isDeleteMode.value"
        @click="editor.toggleDeleteMode()"
      />
    </UTooltip>

    <UTooltip :text="t('melodyLoom.controls.clear')">
      <HoldToConfirm :label="t('melodyLoom.controls.clear')" @confirm="editor.clearGrid()" />
    </UTooltip>

    <div class="grow" />

    <MelodyLoomPresetSelector />

    <USeparator orientation="vertical" class="h-8" />

    <UTooltip :text="t('melodyLoom.controls.exportWavHint')">
      <UButton
        :label="t('melodyLoom.controls.exportWav')"
        icon="lucide:file-audio"
        color="primary"
        :loading="isExporting"
        :disabled="!editor.hasNotes.value"
        class="h-9 shrink-0 gap-1.5 rounded-md px-3"
        @click="exportWav"
      />
    </UTooltip>
  </div>
</template>
