<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'
import { SELECTION_ONLY_EFFECTS, WAVEFORM_EFFECTS } from '~/composables/useWaveformEditor'
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

// ─── Editing ────────────────────────────────────────────────────────────────

// Deleting the whole take leaves no buffer but plenty of history, so the strip
// has to outlive the audio for undo to be reachable.
const showEditTools = computed(() => Boolean(editor.buffer.value) || editor.canUndo.value)

const EFFECT_ICONS: Record<(typeof WAVEFORM_EFFECTS)[number], string> = {
  normalize: 'lucide:audio-waveform',
  amplify: 'lucide:volume-2',
  reduce: 'lucide:volume-1',
  fadeIn: 'lucide:trending-up',
  fadeOut: 'lucide:trending-down',
  echo: 'lucide:repeat',
  reverb: 'lucide:waves'
}

const effectItems = computed<DropdownMenuItem[]>(() =>
  WAVEFORM_EFFECTS.map(effect => ({
    label: t(`melodyLoom.waveform.effect.${effect}`),
    icon: EFFECT_ICONS[effect],
    disabled: !editor.selection.value && SELECTION_ONLY_EFFECTS.includes(effect),
    onSelect: () => editor.applyEffect(effect)
  }))
)

const pitch = ref(0)
const volume = ref(100)
const isNeutral = computed(() => pitch.value === 0 && volume.value === 100)

function applyPitchAndVolume() {
  editor.applyPitchShift(pitch.value)
  editor.applyVolume(volume.value)
  // Back to neutral, so a second click on Apply doesn't quietly double a shift
  // the sliders still look like they are only asking for once.
  pitch.value = 0
  volume.value = 100
}

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return

  const meta = event.ctrlKey || event.metaKey
  // Shift held turns `key` into 'Z', not 'z' — compare lowercased so
  // Ctrl/Cmd+Shift+Z actually matches the redo branch below.
  const key = event.key.toLowerCase()

  if (meta && key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  } else if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
    event.preventDefault()
    editor.redo()
  } else if (meta && key === 'x') {
    event.preventDefault()
    editor.cutSelection()
  } else if (meta && key === 'c') {
    event.preventDefault()
    editor.copySelection()
  } else if (meta && key === 'v') {
    event.preventDefault()
    editor.pasteClipboard()
  } else if (!meta && (event.key === 'Delete' || event.key === 'Backspace')) {
    // Only with a range already dragged out, so Backspace elsewhere on the page
    // isn't quietly eating audio.
    if (!editor.selection.value) return
    event.preventDefault()
    editor.deleteSelection()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <section class="flex flex-col gap-2 p-4">
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

      <USeparator orientation="vertical" class="h-8 max-sm:hidden" />

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

      <USeparator orientation="vertical" class="h-8 max-sm:hidden" />

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

      <div class="hidden grow xl:block" />

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

    <template v-if="showEditTools">
      <div class="flex flex-wrap items-center gap-2">
        <UTooltip :text="t('melodyLoom.waveform.undo')">
          <UButton
            icon="lucide:undo-2"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.canUndo.value"
            :aria-label="t('melodyLoom.waveform.undo')"
            @click="editor.undo()"
          />
        </UTooltip>
        <UTooltip :text="t('melodyLoom.waveform.redo')">
          <UButton
            icon="lucide:redo-2"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.canRedo.value"
            :aria-label="t('melodyLoom.waveform.redo')"
            @click="editor.redo()"
          />
        </UTooltip>

        <USeparator orientation="vertical" class="h-8 max-sm:hidden" />

        <UTooltip :text="t('melodyLoom.waveform.cut')">
          <UButton
            icon="lucide:scissors"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.hasSelection.value"
            :aria-label="t('melodyLoom.waveform.cut')"
            @click="editor.cutSelection()"
          />
        </UTooltip>
        <UTooltip :text="t('melodyLoom.waveform.copy')">
          <UButton
            icon="lucide:copy"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.hasSelection.value"
            :aria-label="t('melodyLoom.waveform.copy')"
            @click="editor.copySelection()"
          />
        </UTooltip>
        <UTooltip :text="t('melodyLoom.waveform.paste')">
          <UButton
            icon="lucide:clipboard-paste"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.hasClipboard.value"
            :aria-label="t('melodyLoom.waveform.paste')"
            @click="editor.pasteClipboard()"
          />
        </UTooltip>
        <UTooltip :text="t('melodyLoom.waveform.delete')">
          <UButton
            icon="lucide:trash-2"
            color="neutral"
            variant="outline"
            class="h-9 w-9 justify-center rounded-md"
            :disabled="!editor.hasSelection.value"
            :aria-label="t('melodyLoom.waveform.delete')"
            @click="editor.deleteSelection()"
          />
        </UTooltip>

        <USeparator orientation="vertical" class="h-8 max-sm:hidden" />

        <UDropdownMenu :items="effectItems" :ui="{ content: 'w-48' }">
          <UButton
            :label="t('melodyLoom.waveform.effects')"
            icon="lucide:wand-sparkles"
            trailing-icon="lucide:chevron-down"
            color="neutral"
            variant="outline"
            class="h-9 rounded-md"
            :disabled="!editor.buffer.value"
          />
        </UDropdownMenu>

        <span class="text-xs text-dimmed">
          {{ editor.hasSelection.value
            ? t('melodyLoom.waveform.appliesToSelection')
            : t('melodyLoom.waveform.appliesToTake') }}
        </span>

        <div class="hidden grow xl:block" />

        <UTooltip :text="t('melodyLoom.waveform.exportWavHint')">
          <UButton
            :label="t('melodyLoom.waveform.exportWav')"
            icon="lucide:file-audio"
            color="primary"
            class="h-9 rounded-md"
            :disabled="!editor.buffer.value"
            @click="editor.exportWav()"
          />
        </UTooltip>
      </div>

      <div class="flex flex-wrap items-end gap-4">
        <div class="flex w-40 flex-col gap-1">
          <div class="flex items-center justify-between text-xs text-muted">
            <span>{{ t('melodyLoom.waveform.pitch') }}</span>
            <span class="font-semibold tabular-nums text-highlighted">
              {{ t('melodyLoom.waveform.semitones', { semitones: pitch > 0 ? `+${pitch}` : pitch }) }}
            </span>
          </div>
          <USlider
            v-model="pitch"
            :min="-12"
            :max="12"
            :step="1"
            size="sm"
            :disabled="!editor.buffer.value"
            :aria-label="t('melodyLoom.waveform.pitch')"
          />
        </div>

        <div class="flex w-40 flex-col gap-1">
          <div class="flex items-center justify-between text-xs text-muted">
            <span>{{ t('melodyLoom.waveform.volume') }}</span>
            <span class="font-semibold tabular-nums text-highlighted">{{ volume }}%</span>
          </div>
          <USlider
            v-model="volume"
            :min="0"
            :max="200"
            :step="5"
            size="sm"
            :disabled="!editor.buffer.value"
            :aria-label="t('melodyLoom.waveform.volume')"
          />
        </div>

        <UTooltip :text="t('melodyLoom.waveform.applyHint')">
          <UButton
            :label="t('melodyLoom.waveform.apply')"
            icon="lucide:check"
            color="neutral"
            variant="outline"
            class="h-9 rounded-md"
            :disabled="!editor.buffer.value || isNeutral"
            @click="applyPitchAndVolume"
          />
        </UTooltip>
      </div>
    </template>

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
