<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const MIN_FPS = 1
const MAX_FPS = 30

const playLabel = computed(() =>
  editor.isPlaying.value ? t('pixelStitch.frames.pause') : t('pixelStitch.frames.play')
)

// A drag rather than a field, so the speed can be moved while the animation is
// running and heard immediately. The playback timer watches `fps`, so a change
// mid-run retimes it rather than waiting for the next play.
const fpsRef = ref<HTMLElement | null>(null)
const draggingFps = ref(false)
let dragOrigin = { x: 0, fps: 8 }

function startFpsDrag(event: PointerEvent) {
  draggingFps.value = true
  dragOrigin = { x: event.clientX, fps: editor.fps.value }
  fpsRef.value?.setPointerCapture(event.pointerId)
}

function onFpsDrag(event: PointerEvent) {
  if (!draggingFps.value) return
  // 6px per frame per second: fine enough to land on a value, coarse enough
  // that the whole 1–30 range is a comfortable drag rather than a flick.
  const next = dragOrigin.fps + Math.round((event.clientX - dragOrigin.x) / 6)
  editor.fps.value = Math.min(MAX_FPS, Math.max(MIN_FPS, next))
}

function endFpsDrag() {
  draggingFps.value = false
}

function stepFps(delta: number) {
  editor.fps.value = Math.min(MAX_FPS, Math.max(MIN_FPS, editor.fps.value + delta))
}

function onFpsKeyDown(event: KeyboardEvent) {
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp'
    ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
  if (delta === 0) return
  event.preventDefault()
  stepFps(delta)
}
</script>

<template>
  <!-- Closed, the panel is its own affordance: clicking anywhere on the bar
       opens it, so there is no separate toggle control to find. -->
  <section
    v-if="!editor.animationPanelOpen.value"
    class="flex h-14 cursor-pointer items-center gap-3 px-4"
    role="button"
    tabindex="0"
    :aria-expanded="false"
    @click="editor.animationPanelOpen.value = true"
    @keydown.enter.prevent="editor.animationPanelOpen.value = true"
    @keydown.space.prevent="editor.animationPanelOpen.value = true"
  >
    <UTooltip :text="playLabel">
      <UButton
        :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
        size="sm"
        color="neutral"
        variant="outline"
        :aria-label="playLabel"
        @click.stop="editor.isPlaying.value = !editor.isPlaying.value"
      />
    </UTooltip>
    <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
    <span class="text-sm tabular-nums text-dimmed">
      {{ t('pixelStitch.frames.count', editor.frames.value.length) }}
    </span>
    <Icon name="lucide:chevron-up" class="ml-auto size-4 text-dimmed" />
  </section>

  <section v-else class="flex h-52 flex-col">
    <div class="flex items-center gap-3 px-4 py-2">
      <UTooltip :text="playLabel">
        <UButton
          :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
          size="sm"
          color="neutral"
          variant="outline"
          :aria-label="playLabel"
          @click="editor.isPlaying.value = !editor.isPlaying.value"
        />
      </UTooltip>
      <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
      <UButton
        icon="lucide:chevron-down"
        size="sm"
        color="neutral"
        variant="ghost"
        class="ml-auto"
        :aria-label="t('pixelStitch.frames.collapse')"
        :aria-expanded="true"
        @click="editor.animationPanelOpen.value = false"
      />
    </div>

    <USeparator />

    <div class="flex min-h-0 flex-1 items-stretch gap-4 px-4 py-3">
      <div class="shrink-0"><PixelStitchAnimationPreview /></div>

      <USeparator orientation="vertical" />

      <div class="min-w-0 flex-1"><PixelStitchFrameStrip /></div>

      <USeparator orientation="vertical" />

      <div class="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto">
        <div class="flex items-center gap-2">
          <span class="text-xs text-dimmed">{{ t('pixelStitch.preview.fps') }}</span>
          <UTooltip :text="t('pixelStitch.preview.fpsTooltip')">
            <div
              ref="fpsRef"
              role="slider"
              tabindex="0"
              class="cursor-ew-resize select-none rounded-md px-2 py-0.5 text-sm tabular-nums ring-1 ring-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="draggingFps ? 'bg-elevated' : ''"
              :aria-label="t('pixelStitch.preview.fpsTooltip')"
              :aria-valuemin="MIN_FPS"
              :aria-valuemax="MAX_FPS"
              :aria-valuenow="editor.fps.value"
              @pointerdown="startFpsDrag"
              @pointermove="onFpsDrag"
              @pointerup="endFpsDrag"
              @pointercancel="endFpsDrag"
              @keydown="onFpsKeyDown"
            >
              {{ editor.fps.value }}
            </div>
          </UTooltip>
        </div>

        <PixelStitchOnionSkinControls />
      </div>
    </div>
  </section>
</template>
