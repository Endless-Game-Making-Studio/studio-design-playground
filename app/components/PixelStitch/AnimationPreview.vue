<script setup lang="ts">
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const PREVIEW_SIZE = 128
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

// Playback advances the shared frame cursor, so the main canvas and the frame
// strip follow along — the preview isn't a separate player.
let timer: ReturnType<typeof setInterval> | null = null

function stop() {
  if (timer) clearInterval(timer)
  timer = null
}

watch(
  [() => editor.isPlaying.value, () => editor.fps.value, () => editor.frames.value.length],
  ([playing, fps, frameCount]) => {
    stop()
    if (!playing || frameCount < 2) return
    timer = setInterval(() => {
      editor.currentFrameIndex.value = (editor.currentFrameIndex.value + 1) % editor.frames.value.length
    }, 1000 / fps)
  },
  { immediate: true }
)

onMounted(() => nextTick(draw))
onBeforeUnmount(stop)
</script>

<template>
  <!-- Sits inside the frame strip's card: the preview and the timeline are one
       animation panel, so it brings no card of its own. -->
  <div class="flex w-32 shrink-0 flex-col gap-1.5">
    <!-- Captioned because the preview canvas would otherwise read as one more
         frame thumbnail sitting at the head of the strip. -->
    <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed">
      {{ t('pixelStitch.preview.label') }}
    </p>
    <canvas
      ref="canvasRef"
      :width="PREVIEW_SIZE"
      :height="PREVIEW_SIZE"
      class="w-full rounded-xl ring-1 ring-default"
      role="img"
      :aria-label="t('pixelStitch.preview.title')"
      :style="{ imageRendering: 'pixelated' }"
    />

    <div class="flex items-center justify-between text-xs text-dimmed">
      <span class="tabular-nums">{{ t('pixelStitch.preview.fps') }}: {{ editor.fps.value }}</span>
      <span class="tabular-nums">{{ editor.currentFrameIndex.value + 1 }} / {{ editor.frames.value.length }}</span>
    </div>
    <UTooltip :text="t('pixelStitch.preview.fpsTooltip')">
      <USlider v-model="editor.fps.value" :min="1" :max="30" :step="1" size="xs" class="w-full" />
    </UTooltip>
  </div>
</template>
