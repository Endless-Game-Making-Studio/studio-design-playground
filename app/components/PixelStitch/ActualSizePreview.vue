<script setup lang="ts">
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

/**
 * The drawing at one artwork pixel per screen pixel — a 32×32 canvas shows as
 * 32px square. Small on purpose: the artboard is worked at 400% and up, and
 * this is the only place the sprite is seen at the size it will actually be
 * used at.
 */
const editor = usePixelStitchContext()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)

function draw() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const size = editor.canvasSize.value
  ctx.clearRect(0, 0, size, size)
  drawCheckerboard(ctx, size, size, Math.max(2, Math.round(size / 8)))
  const frame = editor.currentFrame.value
  if (frame) compositeLayers(ctx, frame.layers, size, 1)
}

// Deep: drawing mutates the pixel arrays in place, so nothing about the frame
// reference changes as the artist paints.
watch(
  [() => editor.frames.value, () => editor.currentFrameIndex.value, () => editor.canvasSize.value],
  () => nextTick(draw),
  { deep: true, immediate: true }
)

onMounted(() => nextTick(draw))
</script>

<template>
  <div class="flex flex-col items-center gap-2 p-3">
    <div class="grid place-items-center rounded-md p-2 ring-1 ring-default">
      <canvas
        ref="canvasRef"
        :width="editor.canvasSize.value"
        :height="editor.canvasSize.value"
        :style="{ width: `${editor.canvasSize.value}px`, height: `${editor.canvasSize.value}px`, imageRendering: 'pixelated' }"
        :aria-label="t('pixelStitch.toolbar.actualSize')"
      />
    </div>
    <span class="text-[11px] tabular-nums text-dimmed">
      {{ editor.canvasSize.value }}×{{ editor.canvasSize.value }}
    </span>
  </div>
</template>
