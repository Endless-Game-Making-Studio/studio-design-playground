<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { hexToRgb, isHexColor } from '~/composables/pixelStitch/project'
import { rgbToHex, type Rgb } from '~/composables/pixelStitch/color'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

// ─── Readout ────────────────────────────────────────────────────────────────

// No alpha in either format: a pixel here is painted or empty, and a
// half-opaque value survives on the canvas but not through an export.
const FORMATS = ['rgb', 'hex'] as const
type Format = typeof FORMATS[number]
const format = ref<Format>('rgb')

const formatItems = computed<DropdownMenuItem[]>(() =>
  FORMATS.map(id => ({
    label: id.toUpperCase(),
    type: 'checkbox' as const,
    checked: format.value === id,
    onSelect: () => (format.value = id)
  }))
)

const channels = computed<Rgb>(() => (hexToRgb(editor.currentColor.value) as Rgb) ?? [0, 0, 0])

function setChannel(index: 0 | 1 | 2, value: string | number) {
  const next = [...channels.value] as Rgb
  next[index] = Math.min(255, Math.max(0, Number(value) || 0))
  editor.currentColor.value = rgbToHex(next)
}

// ─── Palette ────────────────────────────────────────────────────────────────

// Four rows of ten: the base hue ramp, two darker shades, and a pastel
// highlight row. One row is on screen and the dropdown above it chooses which —
// forty swatches at once was most of the panel for something an artist scans
// rather than reads.
const ROWS = ['base', 'shade1', 'shade2', 'highlight'] as const
const ROW_LENGTH = 10
const activeRow = ref<typeof ROWS[number]>('base')

const rowItems = computed<DropdownMenuItem[]>(() =>
  ROWS.map(row => ({
    label: t(`pixelStitch.color.row.${row}`),
    type: 'checkbox' as const,
    checked: activeRow.value === row,
    onSelect: () => (activeRow.value = row)
  }))
)

const rowOffset = computed(() => ROWS.indexOf(activeRow.value) * ROW_LENGTH)

function swatchAt(slot: number) {
  return editor.palette.value[rowOffset.value + slot - 1]
}

const draggedColor = ref<string | null>(null)

function onDragStart(event: DragEvent, color: string) {
  draggedColor.value = color
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onDrop(slot: number) {
  const color = draggedColor.value
  draggedColor.value = null
  if (color && isHexColor(color)) editor.setPaletteColor(rowOffset.value + slot - 1, color)
}

// ─── Eyedropper ─────────────────────────────────────────────────────────────

const eyedropperActive = computed(() => editor.currentTool.value === 'eyedropper')

// Toggling back rather than leaving the tool stuck: the eyedropper is a
// one-shot borrow from whatever was in hand, so a second click gives the pencil
// back instead of stranding someone on a tool that only samples.
function toggleEyedropper() {
  editor.currentTool.value = eyedropperActive.value ? 'pencil' : 'eyedropper'
}

const FIELD = 'h-8 rounded-md'
</script>

<template>
  <section class="flex flex-col gap-2.5 p-3.5">
    <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
      {{ t('pixelStitch.color.title') }}
    </p>

    <PixelStitchColorField v-model="editor.currentColor.value">
      <template #leading>
        <UTooltip :text="t('pixelStitch.tools.eyedropperTooltip')">
          <UButton
            icon="lucide:pipette"
            :color="eyedropperActive ? 'primary' : 'neutral'"
            :variant="eyedropperActive ? 'solid' : 'outline'"
            :aria-label="t('pixelStitch.tools.eyedropper')"
            :aria-pressed="eyedropperActive"
            class="size-8 shrink-0 justify-center rounded-md"
            @click="toggleEyedropper"
          />
        </UTooltip>
      </template>
    </PixelStitchColorField>

    <div class="flex items-center gap-1.5">
      <UDropdownMenu :items="formatItems" :ui="{ content: 'w-32' }">
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="lucide:chevron-down"
          :class="[FIELD, 'gap-1.5 px-2.5 text-[13px]']"
          :aria-label="t('pixelStitch.color.formatTooltip')"
        >
          {{ format.toUpperCase() }}
        </UButton>
      </UDropdownMenu>

      <template v-if="format === 'rgb'">
        <UInput
          v-for="(channel, index) in channels"
          :key="index"
          :model-value="channel"
          type="number"
          :min="0"
          :max="255"
          :aria-label="t(`pixelStitch.color.channel.${index === 0 ? 'red' : index === 1 ? 'green' : 'blue'}`)"
          class="min-w-0 grow"
          :ui="{ base: `${FIELD} text-center tabular-nums px-1.5` }"
          @update:model-value="value => setChannel(index as 0 | 1 | 2, value)"
        />
      </template>
      <UInput
        v-else
        v-model="editor.currentColor.value"
        placeholder="#000000"
        :aria-label="t('pixelStitch.color.hexTooltip')"
        class="min-w-0 grow"
        :ui="{ base: `${FIELD} font-mono px-2` }"
      />

      <!-- Draggable so a mixed colour can be dropped into a palette slot. -->
      <UTooltip :text="t('pixelStitch.color.dragToSave')">
        <div
          class="size-8 shrink-0 cursor-grab rounded-md ring-1 ring-default active:cursor-grabbing"
          :style="{ backgroundColor: editor.currentColor.value }"
          draggable="true"
          :aria-label="editor.currentColor.value"
          @dragstart="onDragStart($event, editor.currentColor.value)"
          @dragend="draggedColor = null"
        />
      </UTooltip>
    </div>

    <UDropdownMenu :items="rowItems" :ui="{ content: 'w-full' }">
      <UButton
        color="neutral"
        variant="outline"
        trailing-icon="lucide:chevron-down"
        block
        :class="[FIELD, 'justify-between px-3 text-[13px]']"
      >
        {{ t(`pixelStitch.color.row.${activeRow}`) }}
      </UButton>
    </UDropdownMenu>

    <div class="grid grid-cols-10 gap-1.5">
      <UTooltip
        v-for="slot in ROW_LENGTH"
        :key="slot"
        :text="t('pixelStitch.color.swatchTooltip', { color: swatchAt(slot) ?? '' })"
      >
        <button
          type="button"
          class="aspect-square w-full rounded-md ring-1 ring-default transition-transform duration-150 hover:scale-110"
          :class="editor.currentColor.value === swatchAt(slot) ? 'ring-2 ring-primary' : ''"
          :style="{ backgroundColor: swatchAt(slot) }"
          :aria-label="swatchAt(slot)"
          @click="editor.currentColor.value = swatchAt(slot) ?? '#000000'"
          @dragover.prevent
          @drop.prevent="onDrop(slot)"
        />
      </UTooltip>
    </div>
  </section>
</template>
