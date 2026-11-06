<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { hexToRgb, isHexColor, PALETTE_ROW_LENGTH } from '~/composables/pixelStitch/project'
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

// Four rows: the base hue ramp, two darker shades, and a pastel highlight row.
// One row is on screen and the dropdown above it chooses which — forty swatches
// at once was most of the panel for something an artist scans rather than
// reads. Rows grow, so a row is however long the artist has made it.
const ROWS = ['base', 'shade1', 'shade2', 'highlight'] as const
const activeRow = ref<typeof ROWS[number]>('base')
const rowIndex = computed(() => ROWS.indexOf(activeRow.value))
const swatches = computed(() => editor.palette.value[rowIndex.value] ?? [])

// Each option carries its own row of colours: the four names alone
// ("Colour", "Shade 1"…) leave the artist guessing what is actually in each
// one, and the swatches are the thing being chosen.
// `satisfies` rather than a `DropdownMenuItem[]` annotation, so `colours` and
// the `row` slot name survive into the slot's `item` type.
const rowItems = computed(() =>
  ROWS.map((row, index) => ({
    label: t(`pixelStitch.color.row.${row}`),
    type: 'checkbox' as const,
    checked: activeRow.value === row,
    slot: 'row' as const,
    colours: (editor.palette.value[index] ?? []).slice(0, PALETTE_ROW_LENGTH),
    onSelect: () => (activeRow.value = row)
  })) satisfies DropdownMenuItem[]
)

const draggedColor = ref<string | null>(null)

function onDragStart(event: DragEvent, color: string) {
  draggedColor.value = color
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

// Dropping on a swatch replaces it; dropping on the empty slot at the end adds
// one. Both gestures are the same reach, so both have to land somewhere.
function onDropOnSwatch(slot: number) {
  const color = draggedColor.value
  draggedColor.value = null
  if (color && isHexColor(color)) editor.setPaletteColor(rowIndex.value, slot, color)
}

function onDropOnEmpty() {
  const color = draggedColor.value
  draggedColor.value = null
  if (color && isHexColor(color)) editor.addPaletteColor(rowIndex.value, color)
}

// Clicking the empty slot saves what is in hand, which is the shorter way to
// the same result as dragging the swatch onto it.
function addCurrentColor() {
  if (isHexColor(editor.currentColor.value)) editor.addPaletteColor(rowIndex.value, editor.currentColor.value)
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

    <UDropdownMenu :items="rowItems" :ui="{ content: 'w-[264px]' }">
      <UButton
        color="neutral"
        variant="outline"
        trailing-icon="lucide:chevron-down"
        block
        :class="[FIELD, 'justify-between px-3 text-[13px]']"
      >
        {{ t(`pixelStitch.color.row.${activeRow}`) }}
      </UButton>
      <template #row="{ item }">
        <span class="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
          <span class="text-[13px]">{{ item.label }}</span>
          <span class="flex gap-1">
            <span
              v-for="(colour, slot) in (item as { colours: string[] }).colours"
              :key="slot"
              class="size-3 shrink-0 rounded-[3px] ring-1 ring-default"
              :style="{ backgroundColor: colour }"
            />
          </span>
        </span>
      </template>
    </UDropdownMenu>

    <!-- `grid-cols-10` with one slot more than there are colours: on a full row
         the empty one wraps onto a new line, which is where the next colour
         lands. -->
    <div class="grid grid-cols-10 gap-1.5">
      <UTooltip
        v-for="(color, slot) in swatches"
        :key="`${activeRow}-${slot}`"
        :text="t('pixelStitch.color.swatchTooltip', { color })"
      >
        <button
          type="button"
          class="aspect-square w-full rounded-md ring-1 ring-default transition-transform duration-150 hover:scale-110"
          :class="editor.currentColor.value === color ? 'ring-2 ring-primary' : ''"
          :style="{ backgroundColor: color }"
          :aria-label="color"
          @click="editor.currentColor.value = color"
          @dragover.prevent
          @drop.prevent="onDropOnSwatch(slot)"
        />
      </UTooltip>

      <UTooltip :text="t('pixelStitch.color.addSwatch')">
        <button
          type="button"
          class="grid aspect-square w-full cursor-pointer place-items-center rounded-md border border-dashed border-default text-dimmed transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :aria-label="t('pixelStitch.color.addSwatch')"
          @click="addCurrentColor"
          @dragover.prevent
          @drop.prevent="onDropOnEmpty"
        >
          <Icon name="lucide:plus" class="size-3.5" />
        </button>
      </UTooltip>
    </div>
  </section>
</template>
