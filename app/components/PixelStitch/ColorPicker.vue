<script setup lang="ts">
import { isHexColor } from '~/composables/pixelStitch/project'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

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
// highlight row. Only the base row is on screen — forty swatches at once is
// most of the panel's height for something an artist scans, not reads.
const ROWS = ['base', 'shade1', 'shade2', 'highlight'] as const
const ROW_LENGTH = 10
const SHADE_ROWS = ROWS.slice(1)

function swatchAt(rowIndex: number, slot: number) {
  return editor.palette.value[rowIndex * ROW_LENGTH + slot - 1]
}

const eyedropperActive = computed(() => editor.currentTool.value === 'eyedropper')

// Toggling back rather than leaving the tool stuck: the eyedropper is a
// one-shot borrow from whatever was in hand, so a second click gives the
// pencil back instead of stranding someone on a tool that only samples.
function toggleEyedropper() {
  editor.currentTool.value = eyedropperActive.value ? 'pencil' : 'eyedropper'
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h3 class="font-heading font-bold text-sm text-highlighted">{{ t('pixelStitch.color.title') }}</h3>

    <!-- Open in the panel rather than behind the swatch: the picker is what
         someone came to this section for. -->
    <UColorPicker v-model="editor.currentColor.value" class="w-full" :ui="{ picker: 'w-full', selector: 'w-full' }" />

    <div class="flex items-center gap-2">
      <UTooltip :text="t('pixelStitch.color.dragToSave')">
        <!-- Draggable so a mixed colour can be dropped into a palette slot.
             `size-8` matches the sm field beside it. -->
        <div
          class="size-8 shrink-0 rounded-lg ring-1 ring-default cursor-grab active:cursor-grabbing"
          :style="{ backgroundColor: editor.currentColor.value }"
          draggable="true"
          @dragstart="onDragStart($event, editor.currentColor.value)"
          @dragend="draggedColor = null"
        />
      </UTooltip>

      <UTooltip :text="t('pixelStitch.color.hexTooltip')" class="min-w-0 flex-1">
        <UInput
          v-model="editor.currentColor.value"
          placeholder="#000000"
          size="sm"
          class="w-full"
          :ui="{ base: 'font-mono' }"
          :aria-label="t('pixelStitch.color.hexTooltip')"
        />
      </UTooltip>

      <UTooltip :text="t('pixelStitch.tools.eyedropperTooltip')">
        <UButton
          icon="lucide:pipette"
          size="sm"
          :color="eyedropperActive ? 'primary' : 'neutral'"
          :variant="eyedropperActive ? 'solid' : 'outline'"
          :aria-label="t('pixelStitch.tools.eyedropper')"
          :aria-pressed="eyedropperActive"
          @click="toggleEyedropper"
        />
      </UTooltip>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
          {{ t(`pixelStitch.color.row.base`) }}
        </p>
        <UPopover>
          <UButton
            :label="t('pixelStitch.color.moreShades')"
            trailing-icon="lucide:chevron-down"
            size="xs"
            color="neutral"
            variant="ghost"
          />
          <template #content>
            <div class="flex w-64 flex-col gap-3 p-3">
              <div v-for="row in SHADE_ROWS" :key="row" class="flex flex-col gap-1">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
                  {{ t(`pixelStitch.color.row.${row}`) }}
                </p>
                <div class="grid grid-cols-10 gap-1">
                  <button
                    v-for="slot in ROW_LENGTH"
                    :key="`${row}-${slot}`"
                    type="button"
                    class="aspect-square w-full rounded ring-1 ring-default transition-transform duration-150 hover:scale-110"
                    :class="editor.currentColor.value === swatchAt(ROWS.indexOf(row), slot) ? 'ring-2 ring-primary' : ''"
                    :style="{ backgroundColor: swatchAt(ROWS.indexOf(row), slot) }"
                    :aria-label="swatchAt(ROWS.indexOf(row), slot)"
                    @click="editor.currentColor.value = swatchAt(ROWS.indexOf(row), slot) ?? '#000000'"
                    @dragover.prevent
                    @drop.prevent="onDrop(ROWS.indexOf(row) * ROW_LENGTH + slot - 1)"
                  />
                </div>
              </div>
            </div>
          </template>
        </UPopover>
      </div>

      <div class="grid grid-cols-10 gap-1.5">
        <UTooltip
          v-for="slot in ROW_LENGTH"
          :key="`base-${slot}`"
          :text="t('pixelStitch.color.swatchTooltip', { color: swatchAt(0, slot) ?? '' })"
        >
          <button
            type="button"
            class="aspect-square w-full rounded-md ring-1 ring-default transition-transform duration-150 hover:scale-110"
            :class="editor.currentColor.value === swatchAt(0, slot) ? 'ring-2 ring-primary' : ''"
            :style="{ backgroundColor: swatchAt(0, slot) }"
            :aria-label="swatchAt(0, slot)"
            @click="editor.currentColor.value = swatchAt(0, slot) ?? '#000000'"
            @dragover.prevent
            @drop.prevent="onDrop(slot - 1)"
          />
        </UTooltip>
      </div>

      <p class="text-xs text-dimmed">{{ t('pixelStitch.color.dragToCustomize') }}</p>
    </div>
  </section>
</template>
