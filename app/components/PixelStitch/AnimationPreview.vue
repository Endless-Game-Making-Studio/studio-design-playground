<script setup lang="ts">
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const PREVIEW_SIZE = 112
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
  <section class="flex flex-col">
    <div class="flex justify-center">
      <canvas
        ref="canvasRef"
        :width="PREVIEW_SIZE"
        :height="PREVIEW_SIZE"
        class="rounded-xl ring-1 ring-default"
        :style="{ imageRendering: 'pixelated' }"
        :aria-label="$t('pixelStitch.preview.title')"
      />
    </div>
  </section>
</template>
