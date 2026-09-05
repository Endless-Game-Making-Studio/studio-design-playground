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

// A resize clears every frame — pixel art cannot be carried from one grid to
// another. On an empty canvas that costs nothing, and asking someone to
// confirm the loss of nothing is how they learn to dismiss the question
// without reading it.
const pendingSize = ref<number | null>(null)

function chooseSize(size: number) {
  if (size === editor.canvasSize.value) return
  if (!editor.hasArtwork.value) {
    editor.setCanvasSize(size)
    return
  }
  pendingSize.value = size
}

function confirmResize() {
  const size = pendingSize.value
  pendingSize.value = null
  if (size !== null) editor.setCanvasSize(size)
}

const pendingLabel = computed(() => (pendingSize.value === null ? '' : `${pendingSize.value}×${pendingSize.value}`))
const currentLabel = computed(() => `${editor.canvasSize.value}×${editor.canvasSize.value}`)
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
          @click="chooseSize(size)"
        />
      </UTooltip>
    </div>
  </section>

  <!-- Dismissible, so Escape and a click outside both land on the safe side.
       The buttons name their action rather than answering yes or no. -->
  <UModal
    :open="pendingSize !== null"
    :title="t('pixelStitch.canvasSize.confirmTitle', { size: pendingLabel })"
    :description="t('pixelStitch.canvasSize.confirmBody')"
    @update:open="value => { if (!value) pendingSize = null }"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('pixelStitch.canvasSize.confirmKeep', { size: currentLabel })"
          color="neutral"
          variant="outline"
          @click="pendingSize = null"
        />
        <UButton
          :label="t('pixelStitch.canvasSize.confirmClear', { size: pendingLabel })"
          color="error"
          @click="confirmResize"
        />
      </div>
    </template>
  </UModal>
</template>
