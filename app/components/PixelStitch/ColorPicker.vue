<script setup lang="ts">
import { hexToRgb, hexToRgba, isHexColor } from '~/composables/pixelStitch/project'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

// The picker reads and writes whole percents; the editor stores 0-1 because
// that's what canvas globalAlpha takes.
const opacityPercent = computed({
  get: () => Math.round(editor.brushOpacity.value * 100),
  set: percent => (editor.brushOpacity.value = (Array.isArray(percent) ? percent[0]! : percent) / 100)
})

const rgb = computed(() => hexToRgb(editor.currentColor.value) ?? [0, 0, 0])

// The swatch preview shows the brush as it will actually paint, opacity
// included — the palette itself always stores opaque hex.
const previewColor = computed(() =>
  editor.brushOpacity.value < 1 && isHexColor(editor.currentColor.value)
    ? hexToRgba(editor.currentColor.value, editor.brushOpacity.value)
    : editor.currentColor.value
)

const draggedColor = ref<string | null>(null)

function onDragStart(event: DragEvent, color: string) {
  draggedColor.value = color
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onDrop(index: number) {
  const color = draggedColor.value
  draggedColor.value = null
  if (color && isHexColor(color)) editor.setPaletteColor(index, color)
}

// Four rows of ten: the base hue ramp, two darker shades, and a pastel
// highlight row. Only the selected row is on screen — a dropdown of rows keeps
// the panel short, and unlike a popover of swatches it leaves every row a
// visible drop target for dragging the current colour onto.
const ROWS = ['base', 'shade1', 'shade2', 'highlight'] as const
const ROW_LENGTH = 10

const rowItems = computed(() =>
  ROWS.map((row, index) => ({ label: t(`pixelStitch.color.row.${row}`), value: index }))
)
const activeRow = ref(0)

const activeSwatches = computed(() =>
  Array.from({ length: ROW_LENGTH }, (_, slot) => {
    const index = activeRow.value * ROW_LENGTH + slot
    return { index, color: editor.palette.value[index] ?? '#000000' }
  })
)
</script>

<template>
  <UPageCard variant="outline" :ui="{ root: 'rounded-2xl', container: 'p-4 sm:p-4 gap-4' }">
    <div class="flex items-center gap-3">
      <UPopover>
        <UTooltip :text="t('pixelStitch.color.currentTooltip')">
          <!-- The swatch is the picker's trigger, and still draggable so a mixed
               colour can be dropped into a palette slot. The checker sits behind
               it so a translucent brush reads as translucent rather than as a
               lighter solid. -->
          <button
            type="button"
            class="size-14 shrink-0 rounded-xl ring-1 ring-default active:cursor-grabbing pixel-checker"
            draggable="true"
            :aria-label="t('pixelStitch.color.currentTooltip')"
            @dragstart="onDragStart($event, editor.currentColor.value)"
            @dragend="draggedColor = null"
          >
            <span class="block size-full rounded-xl" :style="{ backgroundColor: previewColor }" />
          </button>
        </UTooltip>

        <template #content>
          <div class="flex flex-col gap-2 p-2">
            <div class="flex gap-3">
              <UColorPicker v-model="editor.currentColor.value" />

              <!-- Opacity as a third track beside hue: same 8px width and
                   white-ringed thumb as UColorPicker's own tracks, over the
                   checker so the gradient reads as transparency rather than as
                   a fade to white. -->
              <div class="pixel-checker w-2 shrink-0 rounded-md">
                <div
                  class="size-full rounded-md"
                  :style="{ backgroundImage: `linear-gradient(to top, transparent, ${editor.currentColor.value})` }"
                >
                  <!-- `neutral` for a white thumb with a dark ring: the track
                       runs from the picked colour to bare checker, so neither a
                       white nor a coloured ring stays visible along all of it. -->
                  <USlider
                    v-model="opacityPercent"
                    orientation="vertical"
                    color="neutral"
                    :ui="{ track: 'bg-transparent', range: 'bg-transparent' }"
                    :aria-label="t('pixelStitch.color.brushOpacity')"
                  />
                </div>
              </div>
            </div>

            <!-- Under the square rather than over it, as in the reference: white
                 readout text on the swatch itself stops being legible as soon as
                 the picked colour is pale. -->
            <div class="text-center">
              <p class="font-mono text-sm font-semibold text-highlighted">{{ editor.currentColor.value.toUpperCase() }}</p>
              <p class="font-mono text-xs tabular-nums text-dimmed">
                R{{ rgb[0] }} G{{ rgb[1] }} B{{ rgb[2] }} A{{ opacityPercent }}%
              </p>
            </div>
          </div>
        </template>
      </UPopover>

      <UTooltip :text="t('pixelStitch.color.hexTooltip')" class="flex-1 min-w-0">
        <UInput
          v-model="editor.currentColor.value"
          placeholder="#000000"
          size="sm"
          class="w-full"
          :ui="{ base: 'font-mono' }"
          :aria-label="t('pixelStitch.color.hexTooltip')"
        />
      </UTooltip>
    </div>

    <div class="flex flex-col gap-2">
      <USelect
        v-model="activeRow"
        :items="rowItems"
        size="xs"
        class="w-full"
        :aria-label="t('pixelStitch.color.rowLabel')"
      />
      <div class="grid grid-cols-10 gap-1.5">
        <UTooltip
          v-for="swatch in activeSwatches"
          :key="swatch.index"
          :text="t('pixelStitch.color.swatchTooltip', { color: swatch.color })"
        >
          <button
            type="button"
            class="aspect-square w-full rounded-md ring-1 ring-default transition-transform duration-150 hover:scale-110"
            :class="editor.currentColor.value === swatch.color ? 'ring-2 ring-primary' : ''"
            :style="{ backgroundColor: swatch.color }"
            :aria-label="swatch.color"
            @click="editor.currentColor.value = swatch.color"
            @dragover.prevent
            @drop.prevent="onDrop(swatch.index)"
          />
        </UTooltip>
      </div>
      <p class="text-xs text-dimmed">{{ t('pixelStitch.color.dragToCustomize') }}</p>
    </div>
  </UPageCard>
</template>
