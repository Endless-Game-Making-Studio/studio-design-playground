<script setup lang="ts">
import { CANVAS_SIZES } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const sizeItems = CANVAS_SIZES.map(size => ({ label: `${size}×${size}`, value: size }))

// Writes through `setCanvasSize` rather than the ref: resizing has to clear
// every frame and reset history, which assigning `canvasSize` alone wouldn't.
const selectedSize = computed({
  get: () => editor.canvasSize.value,
  set: size => editor.setCanvasSize(size)
})
</script>

<template>
  <!-- Uncarded: this rides in the canvas card's control row, next to the zoom
       stepper and the undo/redo/grid group. -->
  <div class="flex items-center gap-2">
    <span class="text-sm text-muted">{{ t('pixelStitch.canvasSize.label') }}</span>
    <!-- The tooltip is the only warning that switching size wipes the
         artwork — the confirmation toast it used to show came after the fact. -->
    <UTooltip :text="t('pixelStitch.canvasSize.tooltip')">
      <USelect
        v-model="selectedSize"
        :items="sizeItems"
        icon="lucide:grid-2x2"
        size="sm"
        class="w-32"
        :aria-label="t('pixelStitch.canvasSize.label')"
      />
    </UTooltip>
  </div>
</template>
