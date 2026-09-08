<script setup lang="ts">
import type { Frame } from '~/composables/pixelStitch/types'
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const PREVIEW_SIZE = 88

const previewRefs = ref<HTMLCanvasElement[]>([])

function drawPreview(canvas: HTMLCanvasElement | undefined, frame: Frame) {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  drawCheckerboard(ctx, PREVIEW_SIZE, PREVIEW_SIZE, 8)
  compositeLayers(ctx, frame.layers, editor.canvasSize.value, PREVIEW_SIZE / editor.canvasSize.value)
}

function drawAllPreviews() {
  editor.frames.value.forEach((frame, index) => drawPreview(previewRefs.value[index], frame))
}

// Deep: drawing mutates the pixel arrays in place, so the thumbnails would
// otherwise only refresh when a frame is added or removed.
watch(
  [() => editor.frames.value, () => editor.canvasSize.value],
  () => nextTick(drawAllPreviews),
  { deep: true, immediate: true }
)

onMounted(() => nextTick(drawAllPreviews))

// Native drag rather than a drag-and-drop library: reordering a handful of
// thumbnails needs an index swap, not a physics-animated sortable list.
const dragIndex = ref<number | null>(null)

function onDrop(target: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from !== null) editor.reorderFrames(from, target)
}

// With onion skin on, the two neighbours of the current frame carry the colour
// of the ghost they draw on the canvas — a border on the tile, not a band
// inside it, so the thumbnail itself stays readable.
function tileBorder(index: number) {
  if (editor.currentFrameIndex.value === index) return 'border-primary bg-slate-100'
  if (editor.onionSkin.value) {
    if (index === editor.currentFrameIndex.value - 1) return 'border-cornflower-500'
    if (index === editor.currentFrameIndex.value + 1) return 'border-teal-500'
  }
  return 'border-default'
}
</script>

<template>
  <!-- 10px between tiles. `items-stretch` so every tile, and the dashed one
       that adds a frame, is exactly as tall as the row. -->
  <section class="flex h-full items-stretch gap-2.5 overflow-x-auto">
    <div
      v-for="(frame, index) in editor.frames.value"
      :key="frame.id"
      class="flex w-[104px] shrink-0 cursor-grab flex-col gap-1 rounded-[10px] border p-1.5 transition-opacity active:cursor-grabbing"
      :class="[tileBorder(index), dragIndex === index ? 'opacity-50' : '']"
      draggable="true"
      @click="editor.selectFrame(index)"
      @dragstart="dragIndex = index"
      @dragend="dragIndex = null"
      @dragover.prevent
      @drop.prevent="onDrop(index)"
    >
      <div class="grid h-[76px] shrink-0 place-items-center rounded-md ring-1 ring-default">
        <canvas
          :ref="element => { if (element) previewRefs[index] = element as HTMLCanvasElement }"
          :width="PREVIEW_SIZE"
          :height="PREVIEW_SIZE"
          class="aspect-square max-h-full rounded"
          :style="{ imageRendering: 'pixelated' }"
        />
      </div>
      <div class="flex h-6 shrink-0 items-center gap-0.5">
        <!-- The counter left the panel header for this: the number is on the
             tile, which is where you are looking. -->
        <span
          class="grow text-xs tabular-nums"
          :class="editor.currentFrameIndex.value === index ? 'font-semibold text-highlighted' : 'text-dimmed'"
        >
          {{ index + 1 }}
        </span>
        <UTooltip :text="t('pixelStitch.frames.duplicate')">
          <UButton
            icon="lucide:copy"
            color="neutral"
            variant="ghost"
            :aria-label="t('pixelStitch.frames.duplicate')"
            class="size-6 shrink-0 justify-center rounded-[5px]"
            @click.stop="editor.duplicateFrame(index)"
          />
        </UTooltip>
        <UTooltip :text="t('pixelStitch.frames.delete')">
          <HoldToConfirm
            :label="t('pixelStitch.frames.delete')"
            :disabled="editor.frames.value.length === 1"
            size="sm"
            @confirm="editor.deleteFrame(index)"
          />
        </UTooltip>
      </div>
    </div>

    <!-- The Add button left the header: a new frame appears at the end of the
         strip, so the control that makes one belongs there. -->
    <UTooltip :text="t('pixelStitch.frames.addTooltip')">
      <button
        type="button"
        class="flex w-[104px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-default text-dimmed transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="t('pixelStitch.frames.addTooltip')"
        @click="editor.addFrame()"
      >
        <Icon name="lucide:plus" class="size-5" />
      </button>
    </UTooltip>
  </section>
</template>
