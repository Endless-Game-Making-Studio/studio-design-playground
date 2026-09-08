<script setup lang="ts">
import { fractionWithin, hexToHsv, hsvToHex, hueHex } from '~/composables/pixelStitch/color'

/**
 * The saturation/value square and the hue track under it.
 *
 * Hand-rolled rather than `UColorPicker`: that component fixes its hue track
 * vertically beside the square (its drag maths reads `scrollHeight` on a
 * `y`-axis container), and this panel needs the track horizontal, underneath,
 * sharing its row with the eyedropper. A custom editor surface is the one place
 * the design system leaves to raw markup.
 */
const model = defineModel<string>({ required: true })

const squareRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)

// The hue is kept locally as well as read from the model: at full white or
// full black the hex carries no hue at all, and rereading it would snap the
// square back to red the moment someone dragged into a corner.
const hsv = ref(hexToHsv(model.value))

watch(model, (value) => {
  const next = hexToHsv(value)
  if (hsvToHex(next) === hsvToHex(hsv.value)) return
  hsv.value = next.s === 0 || next.v === 0 ? { ...next, h: hsv.value.h } : next
})

function commit() {
  model.value = hsvToHex(hsv.value)
}

function dragSquare(event: PointerEvent) {
  if (!squareRef.value) return
  const { x, y } = fractionWithin(squareRef.value, event.clientX, event.clientY)
  hsv.value = { h: hsv.value.h, s: x, v: 1 - y }
  commit()
}

function dragTrack(event: PointerEvent) {
  if (!trackRef.value) return
  const { x } = fractionWithin(trackRef.value, event.clientX, event.clientY)
  hsv.value = { ...hsv.value, h: x }
  commit()
}

function capture(event: PointerEvent, move: (event: PointerEvent) => void) {
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  dragging.value = move
  move(event)
}

const dragging = ref<((event: PointerEvent) => void) | null>(null)

function onMove(event: PointerEvent) {
  dragging.value?.(event)
}

function release() {
  dragging.value = null
}

function nudge(event: KeyboardEvent, axis: 'h' | 's' | 'v', step: number) {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
    ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
  if (direction === 0) return
  event.preventDefault()
  const next = Math.min(1, Math.max(0, hsv.value[axis] + direction * step))
  hsv.value = { ...hsv.value, [axis]: next }
  commit()
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <div
      ref="squareRef"
      role="application"
      tabindex="0"
      class="relative h-[132px] cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :style="{ backgroundColor: hueHex(hsv.h) }"
      :aria-label="$t('pixelStitch.color.pickerTooltip')"
      @pointerdown="capture($event, dragSquare)"
      @pointermove="onMove"
      @pointerup="release"
      @pointercancel="release"
      @keydown="nudge($event, 's', 0.02)"
    >
      <div class="absolute inset-0 rounded-lg bg-linear-to-r from-white to-transparent" />
      <div class="absolute inset-0 rounded-lg bg-linear-to-t from-black to-transparent" />
      <div
        class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(2,6,24,.25)]"
        :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }"
      />
    </div>

    <!-- The eyedropper shares the hue track's row: it is the other way of
         choosing a colour, and this is where someone already is when they want
         it. -->
    <div class="flex items-center gap-2.5">
      <slot name="leading" />

      <div
        ref="trackRef"
        role="slider"
        tabindex="0"
        class="relative h-2.5 grow cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style="background: linear-gradient(to right, #ff0000, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000)"
        :aria-label="$t('pixelStitch.color.hueTooltip')"
        :aria-valuemin="0"
        :aria-valuemax="360"
        :aria-valuenow="Math.round(hsv.h * 360)"
        @pointerdown="capture($event, dragTrack)"
        @pointermove="onMove"
        @pointerup="release"
        @pointercancel="release"
        @keydown="nudge($event, 'h', 1 / 36)"
      >
        <div
          class="pointer-events-none absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(2,6,24,.35)]"
          :style="{ left: `${hsv.h * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>
