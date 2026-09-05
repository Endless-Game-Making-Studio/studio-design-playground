<script setup lang="ts">
import type { Frame } from '~/composables/pixelStitch/types'
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const PREVIEW_SIZE = 64

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
</script>

<template>
  <section class="flex h-full flex-col">
    <div class="flex h-full items-start gap-2 overflow-x-auto pb-1">
      <div
        v-for="(frame, index) in editor.frames.value"
        :key="frame.id"
        class="shrink-0 rounded-xl p-2 bg-elevated ring-1 transition-opacity cursor-grab active:cursor-grabbing"
        :class="[
          editor.currentFrameIndex.value === index ? 'ring-2 ring-primary' : 'ring-default',
          dragIndex === index ? 'opacity-50' : ''
        ]"
        draggable="true"
        @click="editor.selectFrame(index)"
        @dragstart="dragIndex = index"
        @dragend="dragIndex = null"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
      >
        <canvas
          :ref="element => { if (element) previewRefs[index] = element as HTMLCanvasElement }"
          :width="PREVIEW_SIZE"
          :height="PREVIEW_SIZE"
          class="rounded-md"
          :style="{ imageRendering: 'pixelated' }"
        />
        <div class="mt-1.5 flex items-center justify-between gap-1">
          <span class="text-xs text-dimmed tabular-nums">{{ t('pixelStitch.frames.frame') }} {{ index + 1 }}</span>
          <div class="flex">
            <UTooltip :text="t('pixelStitch.frames.duplicate')">
              <UButton
                icon="lucide:copy"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="t('pixelStitch.frames.duplicate')"
                @click.stop="editor.duplicateFrame(index)"
              />
            </UTooltip>
            <UTooltip :text="t('pixelStitch.frames.delete')">
              <HoldToConfirm
                :label="t('pixelStitch.frames.delete')"
                :disabled="editor.frames.value.length === 1"
                @confirm="editor.deleteFrame(index)"
              />
            </UTooltip>
          </div>
        </div>
      </div>

      <!-- The Add button left the header for this: a new frame appears at the
           end of the strip, so the control that makes one belongs there. -->
      <UTooltip :text="t('pixelStitch.frames.addTooltip')">
        <button
          type="button"
          class="flex h-[110px] w-[84px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-default text-dimmed transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :aria-label="t('pixelStitch.frames.addTooltip')"
          @click="editor.addFrame()"
        >
          <Icon name="lucide:plus" class="size-5" />
          <span class="text-xs">{{ t('pixelStitch.frames.add') }}</span>
        </button>
      </UTooltip>
    </div>
  </section>
</template>
