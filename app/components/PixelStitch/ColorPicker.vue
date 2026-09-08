<script setup lang="ts">
import { hexToRgb, isHexColor } from '~/composables/pixelStitch/project'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const rgb = computed(() => hexToRgb(editor.currentColor.value) ?? [0, 0, 0])

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
      <UTooltip :text="t('pixelStitch.color.currentTooltip')">
        <!-- Just the brush as it will actually paint, and the handle you drag
             onto a palette slot. Height matches the hex field beside it rather
             than the old oversized square. -->
        <div
          class="h-7 w-14 shrink-0 rounded-xl ring-1 ring-default cursor-grab active:cursor-grabbing"
          draggable="true"
          :style="{ backgroundColor: editor.currentColor.value }"
          @dragstart="onDragStart($event, editor.currentColor.value)"
          @dragend="draggedColor = null"
        />
      </UTooltip>

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

      <!-- Moved in from the tool rail: the picker is where someone is when
           they want to sample a colour off the canvas. -->
      <UTooltip :text="t('pixelStitch.tools.eyedropperTooltip')">
        <UButton
          icon="lucide:pipette"
          size="sm"
          :color="editor.currentTool.value === 'eyedropper' ? 'primary' : 'neutral'"
          :variant="editor.currentTool.value === 'eyedropper' ? 'solid' : 'outline'"
          :aria-label="t('pixelStitch.tools.eyedropper')"
          @click="editor.currentTool.value = 'eyedropper'"
        />
      </UTooltip>
    </div>

    <!-- The picker sits open in the panel rather than behind a click: picking a
         colour is the thing you do most in here. `selector` is widened off its
         fixed theme size so the square fills the panel. -->
    <div class="flex flex-col gap-2">
      <UColorPicker
        v-model="editor.currentColor.value"
        class="w-full"
        :ui="{ selector: 'w-full h-40', track: 'h-40' }"
      />

      <p class="text-center font-mono text-xs tabular-nums text-dimmed">
        R{{ rgb[0] }} G{{ rgb[1] }} B{{ rgb[2] }}
      </p>
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
