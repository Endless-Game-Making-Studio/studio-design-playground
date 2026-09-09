<script setup lang="ts">
import {
  PAN_WHEEL_FRACTION,
  ZOOM_WHEEL_FACTOR,
  computePeaks,
  tickInterval,
  timeToX,
  xToTime
} from '~/composables/melodyLoom/waveformView'
import { useWaveformEditorContext } from '~/composables/useWaveformEditorContext'

const editor = useWaveformEditorContext()
const { t } = useI18n()

const CANVAS_HEIGHT = 180
// The bottom strip the time ruler sits in — the envelope stops above it so
// labels never land inside the sound.
const RULER_HEIGHT = 18

const wrapperEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const width = ref(0)

// ─── Drawing ────────────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || width.value <= 0) return

  // Re-read every frame: the block can move between a 1x and a 2x display,
  // and setting width/height also resets the transform, so both have to be
  // reapplied together.
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(width.value * dpr))
  canvas.height = Math.round(CANVAS_HEIGHT * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width.value, CANVAS_HEIGHT)

  // Straight from the theme's own custom properties, so the block follows a
  // light/dark switch without a second palette living in here.
  const styles = getComputedStyle(canvas)
  const themeColor = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const waveColor = themeColor('--ui-primary', '#ff6900')
  const gridColor = themeColor('--ui-border', '#dcdce9')
  const labelColor = themeColor('--ui-text-dimmed', '#62748e')
  const cursorColor = themeColor('--ui-secondary', '#6556f0')
  const playheadColor = themeColor('--ui-warning', '#e07100')

  const laneHeight = CANVAS_HEIGHT - RULER_HEIGHT
  const midY = laneHeight / 2
  const view = editor.view.value

  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, midY + 0.5)
  ctx.lineTo(width.value, midY + 0.5)
  ctx.stroke()

  const buffer = editor.buffer.value
  if (buffer) {
    const selection = editor.selection.value
    if (selection) {
      ctx.fillStyle = cursorColor
      ctx.globalAlpha = 0.14
      const from = timeToX(selection.start, view, width.value)
      const to = timeToX(selection.end, view, width.value)
      ctx.fillRect(from, 0, to - from, laneHeight)
      ctx.globalAlpha = 1
    }

    const columns = Math.max(1, Math.floor(width.value))
    const peaks = computePeaks(buffer, view, columns)
    const amplitude = midY * 0.9

    ctx.beginPath()
    for (let x = 0; x < peaks.length; x++) ctx.lineTo(x, midY - peaks[x]!.max * amplitude)
    for (let x = peaks.length - 1; x >= 0; x--) ctx.lineTo(x, midY - peaks[x]!.min * amplitude)
    ctx.closePath()
    ctx.fillStyle = waveColor
    ctx.globalAlpha = 0.35
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = waveColor
    ctx.stroke()

    if (selection) {
      ctx.strokeStyle = cursorColor
      ctx.lineWidth = 2
      for (const edge of [selection.start, selection.end]) {
        const x = Math.round(timeToX(edge, view, width.value)) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, laneHeight)
        ctx.stroke()
      }
      ctx.lineWidth = 1
    }

    // Two separate marks: where a click parked the cursor, and where playback
    // has actually reached. They only coincide before Play is pressed.
    const marks: [number, string][] = [[editor.cursor.value, cursorColor]]
    if (editor.isPlaying.value) marks.push([editor.playhead.value, playheadColor])

    for (const [seconds, color] of marks) {
      const x = timeToX(seconds, view, width.value)
      if (x < 0 || x > width.value) continue
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, 0)
      ctx.lineTo(Math.round(x) + 0.5, laneHeight)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x - 5, 0)
      ctx.lineTo(x + 5, 0)
      ctx.lineTo(x, 7)
      ctx.fill()
    }
    ctx.lineWidth = 1
  }

  const span = view.end - view.start
  if (span > 0) {
    const interval = tickInterval(span)
    const decimals = interval < 1 ? 2 : 1
    ctx.fillStyle = labelColor
    ctx.font = '10px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.strokeStyle = gridColor

    for (let time = Math.ceil(view.start / interval) * interval; time <= view.end; time += interval) {
      const x = Math.round(timeToX(time, view, width.value)) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, laneHeight)
      ctx.lineTo(x, laneHeight + 4)
      ctx.stroke()
      ctx.fillText(`${time.toFixed(decimals)}s`, x, CANVAS_HEIGHT - 4)
    }
  }
}

let observer: ResizeObserver | null = null

function measure() {
  if (wrapperEl.value) width.value = Math.max(1, wrapperEl.value.clientWidth)
}

onMounted(() => {
  // Measured and drawn once here rather than waiting on the observer's first
  // delivery — that arrives with the next rendering step, which a background
  // tab never takes, leaving the block blank until it is looked at.
  measure()
  draw()

  observer = new ResizeObserver(() => {
    measure()
    draw()
  })
  observer.observe(wrapperEl.value!)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// Drawn straight from the watcher rather than through a frame callback: Vue
// already coalesces a burst of changes into one run, and the playhead's own
// loop is what paces redraws during playback.
watch(
  () => [
    editor.buffer.value,
    editor.view.value.start,
    editor.view.value.end,
    editor.selection.value,
    editor.cursor.value,
    editor.playhead.value,
    editor.isPlaying.value
  ],
  draw
)

// ─── Pointer interaction ────────────────────────────────────────────────────

// In pixels rather than seconds: a threshold in time would mean a nudge at
// full zoom-out counts as a drag while a deliberate one at 512x does not.
const DRAG_THRESHOLD_PX = 3

let dragStartX = 0
let dragStartTime = 0
let dragging = false
let dragged = false

function localX(event: PointerEvent | WheelEvent): number {
  const rect = canvasEl.value!.getBoundingClientRect()
  return event.clientX - rect.left
}

function timeAt(event: PointerEvent | WheelEvent): number {
  return xToTime(localX(event), editor.view.value, width.value)
}

function onPointerDown(event: PointerEvent) {
  if (!editor.buffer.value) return
  dragging = true
  dragged = false
  dragStartX = localX(event)
  dragStartTime = timeAt(event)
  // A mousedown clears the old selection before it's known whether this turns
  // into a click or a drag — either way the previous range is finished with.
  editor.clearSelection()

  // Capture only keeps the drag alive past the edge of the canvas. It throws
  // rather than failing quietly for a pointer that isn't active, and losing
  // that is not worth abandoning the gesture over.
  try {
    canvasEl.value?.setPointerCapture(event.pointerId)
  } catch {
    // Tracking just stops at the canvas edge.
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  if (!dragged && Math.abs(localX(event) - dragStartX) < DRAG_THRESHOLD_PX) return
  dragged = true
  editor.setSelection({ start: dragStartTime, end: timeAt(event) })
}

function onPointerUp(event: PointerEvent) {
  if (!dragging) return
  if (!dragged) editor.setCursor(timeAt(event))
  dragging = false
  dragged = false
  if (canvasEl.value?.hasPointerCapture(event.pointerId)) {
    canvasEl.value.releasePointerCapture(event.pointerId)
  }
}

function onWheel(event: WheelEvent) {
  if (!editor.buffer.value) return
  event.preventDefault()

  // Panning is only meaningful once part of the take is off-screen, so an
  // accidental shift at full zoom-out still zooms rather than doing nothing.
  if (event.shiftKey && editor.isZoomed.value) {
    const span = editor.view.value.end - editor.view.value.start
    editor.panBy((event.deltaX || event.deltaY) * PAN_WHEEL_FRACTION * span)
    return
  }

  editor.zoomAt(timeAt(event), Math.exp(-event.deltaY * ZOOM_WHEEL_FACTOR))
}

// ─── Keyboard interaction ───────────────────────────────────────────────────

// The pointer gestures above have no keyboard equivalent of their own, so the
// canvas takes focus and maps the same moves onto keys.
// A fraction of the visible span, not a fixed number of seconds: one press
// should feel like the same nudge whether the whole take is on screen or a
// tenth of a second of it is.
const NUDGE_FRACTION = 0.02
const KEY_ZOOM_FACTOR = 1.3

// Shift + arrow grows one range instead of restarting it on every press, so
// the edge being moved is tracked separately from the end it grew out of.
let selectionAnchor: number | null = null
let selectionHead = 0

function onKeyDown(event: KeyboardEvent) {
  if (!editor.buffer.value) return

  const total = editor.duration.value
  const clampTime = (value: number) => Math.max(0, Math.min(total, value))
  const span = editor.view.value.end - editor.view.value.start

  const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0

  if (direction !== 0) {
    event.preventDefault()
    const step = direction * span * NUDGE_FRACTION

    if (event.shiftKey) {
      if (selectionAnchor === null || !editor.selection.value) {
        selectionAnchor = editor.cursor.value
        selectionHead = editor.cursor.value
      }
      selectionHead = clampTime(selectionHead + step)
      editor.setSelection({ start: selectionAnchor, end: selectionHead })
      return
    }

    selectionAnchor = null
    editor.clearSelection()
    editor.setCursor(clampTime(editor.cursor.value + step))
    return
  }

  switch (event.key) {
    case 'Home':
    case 'End':
      event.preventDefault()
      selectionAnchor = null
      editor.clearSelection()
      editor.setCursor(event.key === 'Home' ? 0 : total)
      break
    case '+':
    case '=':
      event.preventDefault()
      editor.zoomAt(editor.cursor.value, KEY_ZOOM_FACTOR)
      break
    case '-':
      event.preventDefault()
      editor.zoomAt(editor.cursor.value, 1 / KEY_ZOOM_FACTOR)
      break
    case '0':
      event.preventDefault()
      editor.resetView()
      break
    case 'Escape':
      if (!editor.selection.value) return
      event.preventDefault()
      selectionAnchor = null
      editor.clearSelection()
      break
  }
}

// ─── Scrollbar ──────────────────────────────────────────────────────────────

// A real overflow strip rather than a drawn or slider-shaped stand-in: the
// browser's own thumb already sizes itself to the visible fraction, which is
// the one thing a slider can't show.
// Both directions settle on the same number instead of guarding with a
// "we're syncing" flag, so the strip echoing back a scroll it was just given
// is a no-op rather than a fight.
const PAN_EPSILON = 1e-4

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  const range = el.scrollWidth - el.clientWidth
  const next = range > 0 ? (el.scrollLeft / range) * editor.panLimit.value : 0
  if (Math.abs(next - editor.pan.value) < PAN_EPSILON) return
  editor.setPan(next)
}

watch([() => editor.pan.value, () => editor.zoom.value], async () => {
  await nextTick()
  const el = scrollEl.value
  if (!el) return
  const range = el.scrollWidth - el.clientWidth
  const limit = editor.panLimit.value
  el.scrollLeft = limit > 0 ? (editor.pan.value / limit) * range : 0
})

// ─── Readouts ───────────────────────────────────────────────────────────────

const seconds = (value: number) => value.toFixed(2)

const bufferSummary = computed(() => {
  const buffer = editor.buffer.value
  if (!buffer) return null
  return t('melodyLoom.waveform.bufferSummary', {
    duration: seconds(buffer.duration),
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels
  })
})

const selectionSummary = computed(() => {
  const selection = editor.selection.value
  if (!selection) return null
  return t('melodyLoom.waveform.selectionSummary', {
    start: seconds(selection.start),
    end: seconds(selection.end),
    length: seconds(selection.end - selection.start)
  })
})

// One label carrying both readouts: a keyboard user moving the selection can't
// see the two badges drawn over the canvas they are focused on.
const canvasLabel = computed(() => {
  if (!bufferSummary.value) return t('melodyLoom.waveform.emptyTitle')
  return selectionSummary.value
    ? `${bufferSummary.value} — ${selectionSummary.value}`
    : bufferSummary.value
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <div ref="wrapperEl" class="relative overflow-hidden rounded-md border border-default bg-elevated">
      <canvas
        ref="canvasEl"
        :role="editor.buffer.value ? 'application' : 'img'"
        :tabindex="editor.buffer.value ? 0 : -1"
        :aria-label="canvasLabel"
        class="block w-full touch-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="editor.buffer.value ? 'cursor-crosshair' : 'cursor-default'"
        :style="{ height: `${CANVAS_HEIGHT}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel="onWheel"
        @keydown="onKeyDown"
      />

      <div
        v-if="!editor.buffer.value"
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
      >
        <p class="text-sm font-semibold text-muted">{{ t('melodyLoom.waveform.emptyTitle') }}</p>
        <p class="text-xs text-dimmed">{{ t('melodyLoom.waveform.emptyHint') }}</p>
      </div>

      <p
        v-if="bufferSummary"
        class="pointer-events-none absolute left-2 top-2 rounded bg-default/80 px-1.5 py-0.5 text-xs tabular-nums text-dimmed"
      >
        {{ bufferSummary }}
      </p>
      <p
        v-if="selectionSummary"
        aria-live="polite"
        class="pointer-events-none absolute right-2 top-2 rounded bg-default/80 px-1.5 py-0.5 text-xs tabular-nums text-dimmed"
      >
        {{ selectionSummary }}
      </p>
    </div>

    <div
      v-if="editor.isZoomed.value"
      ref="scrollEl"
      class="overflow-x-auto"
      :aria-label="t('melodyLoom.waveform.scroll')"
      @scroll="onScroll"
    >
      <div class="h-px" :style="{ width: `${editor.zoom.value * 100}%` }" />
    </div>
  </div>
</template>
