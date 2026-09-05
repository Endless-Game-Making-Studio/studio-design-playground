<script setup lang="ts">
import { CANVAS_SIZES } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false
})

const editor = usePixelStitchContext()
const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-2" :class="{ 'sm:flex-row sm:items-center': compact }">
      <span class="text-sm font-semibold text-muted">{{ t('pixelStitch.canvasSize.label') }}</span>
    <div class="grid grid-cols-2 gap-2" :class="{ 'sm:flex sm:flex-wrap': compact }">
      <UTooltip
        v-for="size in CANVAS_SIZES"
        :key="size"
        :text="t('pixelStitch.canvasSize.tooltip', { size: `${size}×${size}` })"
      >
        <UButton
          :label="`${size}×${size}`"
          size="sm"
          :color="editor.canvasSize.value === size ? 'primary' : 'neutral'"
          :variant="editor.canvasSize.value === size ? 'solid' : 'outline'"
          @click="editor.setCanvasSize(size)"
        />
      </UTooltip>
    </div>
  </section>
</template>
