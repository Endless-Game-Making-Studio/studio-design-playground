<script setup lang="ts">
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()

// The backing store is a fixed square; CSS sizes it to whatever box the panel
// gives it. `aspect-square` keeps the artwork from stretching when that box is
// wider than it is tall, which the 104px column is.
const PREVIEW_SIZE = 96
const canvasRef = ref<HTMLCanvasElement | null>(null)

function draw() {
  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  drawCheckerboard(ctx, PREVIEW_SIZE, PREVIEW_SIZE, 8)
  const frame = editor.currentFrame.value
  if (frame) compositeLayers(ctx, frame.layers, editor.canvasSize.value, PREVIEW_SIZE / editor.canvasSize.value)
}

watch(
  [() => editor.currentFrameIndex.value, () => editor.frames.value, () => editor.canvasSize.value],
  () => nextTick(draw),
  { deep: true }
)

onMounted(() => nextTick(draw))
</script>

<template>
  <div class="grid min-h-0 w-[104px] place-items-center rounded-lg ring-1 ring-default">
    <canvas
      ref="canvasRef"
      :width="PREVIEW_SIZE"
      :height="PREVIEW_SIZE"
      class="aspect-square max-h-full rounded-md"
      :style="{ imageRendering: 'pixelated' }"
      :aria-label="$t('pixelStitch.preview.title')"
    />
  </div>
</template>
