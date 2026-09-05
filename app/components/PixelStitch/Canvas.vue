<script setup lang="ts">
import type { PixelGrid, Point } from '~/composables/pixelStitch/types'
import { ARTBOARD_SIZE, MAX_ZOOM, MIN_ZOOM } from '~/composables/pixelStitch/types'
import { cloneGrid } from '~/composables/pixelStitch/project'
import { compositeLayers, drawCheckerboard } from '~/composables/pixelStitch/render'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const boardRef = ref<HTMLElement | null>(null)

// Onion-skin ghosts are tinted rather than drawn in their own colors, so past
// and future frames stay distinguishable from the frame being drawn. Brand
// colors instead of the original's magenta/cyan: both read as "not artwork"
// against the light canvas, and they're already the platform's two accents.
const GHOST_PREVIOUS = '#f97316'
const GHOST_NEXT = '#6b8afd'

// Straight hex, no alpha: a pixel here is painted or empty. A half-opaque
// value would survive on the canvas but not through an export, so it can't be
// offered as a colour someone is allowed to pick.
const drawColor = computed(() => editor.currentColor.value)

// ─── Sizing ─────────────────────────────────────────────────────────────────

// One artwork pixel in artboard pixels. The artboard is a fixed square at
// 100%, so this follows only the grid — the window has no say in it, and
// opening the animation panel scrolls the area rather than shrinking the
// drawing.
const pixelSize = computed(() => ARTBOARD_SIZE / editor.canvasSize.value)
const canvasPixels = computed(() => ARTBOARD_SIZE)

const scaledSize = computed(() => ARTBOARD_SIZE * editor.zoom.value)

// What the fit-to-window preset in the top bar resolves to. Measured here
// because the scroll area is the only thing that knows its own size.
function measureFitZoom() {
  const container = containerRef.value
  if (!container) return
  const available = Math.min(container.clientWidth, container.clientHeight) - 32
  editor.fitZoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, available / ARTBOARD_SIZE))
}

// ─── Zoom and panning ───────────────────────────────────────────────────────

// Anchored to the pointer: zooming to the centre of the area makes people
// chase the part they were looking at. The board's rect before and after the
// change is what says how far to scroll, which keeps this correct regardless
// of the centring and padding around it.
async function onWheel(event: WheelEvent) {
  const container = containerRef.value
  const board = boardRef.value
  if (!container || !board) return
  event.preventDefault()

  const before = board.getBoundingClientRect()
  const u = (event.clientX - before.left) / before.width
  const v = (event.clientY - before.top) / before.height

  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, editor.zoom.value * Math.exp(-event.deltaY * 0.0015)))
  if (next === editor.zoom.value) return
  editor.zoom.value = next

  await nextTick()
  const after = board.getBoundingClientRect()
  container.scrollLeft += after.left + u * after.width - event.clientX
  container.scrollTop += after.top + v * after.height - event.clientY
}

// Space-drag pans the area. It has to suppress the drawing handlers while it
// is held, or a pan would lay down a stroke.
const spaceHeld = ref(false)
const panning = ref(false)
let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }

function onPanKeyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || event.repeat) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  event.preventDefault()
  spaceHeld.value = true
}

function onPanKeyUp(event: KeyboardEvent) {
  if (event.code !== 'Space') return
  spaceHeld.value = false
  panning.value = false
}

function onPanStart(event: PointerEvent) {
  const container = containerRef.value
  if (!spaceHeld.value || !container) return
  event.preventDefault()
  panning.value = true
  container.setPointerCapture(event.pointerId)
  panOrigin = { x: event.clientX, y: event.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop }
}

function onPanMove(event: PointerEvent) {
  const container = containerRef.value
  if (!panning.value || !container) return
  container.scrollLeft = panOrigin.scrollLeft - (event.clientX - panOrigin.x)
  container.scrollTop = panOrigin.scrollTop - (event.clientY - panOrigin.y)
}

function onPanEnd() {
  panning.value = false
}

// ─── Painting ───────────────────────────────────────────────────────────────

function paint() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const size = editor.canvasSize.value
  const scale = pixelSize.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawCheckerboard(ctx, canvas.width, canvas.height, scale * 2)

  const onion = editor.onionSkin.value
  if (onion.enabled) {
    // Each step further from the current frame fades further, so the nearest
    // ghost reads as the one to line up against.
    for (let offset = 1; offset <= onion.previousFrames; offset++) {
      const frame = editor.frames.value[editor.currentFrameIndex.value - offset]
      if (!frame) continue
      const alpha = onion.opacity * (1 - offset / (onion.previousFrames + 1))
      compositeLayers(ctx, frame.layers, size, scale, GHOST_PREVIOUS, alpha)
    }
    for (let offset = 1; offset <= onion.nextFrames; offset++) {
      const frame = editor.frames.value[editor.currentFrameIndex.value + offset]
      if (!frame) continue
      const alpha = onion.opacity * (1 - offset / (onion.nextFrames + 1))
      compositeLayers(ctx, frame.layers, size, scale, GHOST_NEXT, alpha)
    }
  }

  const layers = editor.currentFrame.value?.layers ?? []
  compositeLayers(ctx, layers, size, scale)

  if (editor.gridVisible.value) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= size; i++) {
      ctx.beginPath()
      ctx.moveTo(i * scale, 0)
      ctx.lineTo(i * scale, size * scale)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * scale)
      ctx.lineTo(size * scale, i * scale)
      ctx.stroke()
    }
  }

  const stamp = editor.clipboard.value
  const at = editor.pastePreview.value
  if (stamp && at && editor.selectionMode.value === 'pasting') {
    ctx.globalAlpha = 0.8
    for (let y = 0; y < stamp.length; y++) {
      for (let x = 0; x < stamp[y]!.length; x++) {
        const color = stamp[y]![x]
        if (!color) continue
        const targetX = at.x + x
        const targetY = at.y + y
        if (targetX < 0 || targetX >= size || targetY < 0 || targetY >= size) continue
        ctx.fillStyle = color
        ctx.fillRect(targetX * scale, targetY * scale, scale, scale)
      }
    }
    ctx.globalAlpha = 1
    strokeMarquee(ctx, at.x, at.y, stamp[0]!.length, stamp.length, '#16a34a')
  }

  const area = editor.selection.value
  const mode = editor.selectionMode.value
  if (area && (mode === 'selecting' || mode === 'selected')) {
    if (mode === 'selected') {
      ctx.fillStyle = 'rgba(107, 138, 253, 0.16)'
      ctx.fillRect(area.x * scale, area.y * scale, area.width * scale, area.height * scale)
    }
    strokeMarquee(ctx, area.x, area.y, area.width, area.height, '#3b5bdb')
  }
}

function strokeMarquee(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  const scale = pixelSize.value
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.setLineDash([8, 4])
  ctx.strokeRect(x * scale, y * scale, width * scale, height * scale)
  ctx.setLineDash([])
}

// ─── Pointer helpers ────────────────────────────────────────────────────────

// The canvas is CSS-transformed by the zoom control, so client coordinates have
// to be scaled back through its rendered size — `pixelSize` alone would be
// wrong at anything but 100%.
function toGrid(clientX: number, clientY: number): Point | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor(((clientX - rect.left) * (canvas.width / rect.width)) / pixelSize.value)
  const y = Math.floor(((clientY - rect.top) * (canvas.height / rect.height)) / pixelSize.value)
  const size = editor.canvasSize.value
  return x >= 0 && x < size && y >= 0 && y < size ? { x, y } : null
}

// ─── Brush cursor ───────────────────────────────────────────────────────────

// Hiding the size on the tool costs discoverability; this pays it back. The
// square is the brush footprint, snapped to the grid, so someone who never
// opens the stepper still sees the size under their hand.
const cursorPoint = ref<Point | null>(null)

const brushRadius = computed(() =>
  editor.currentTool.value === 'eraser' ? editor.eraserSize.value : editor.brushSize.value
)

const showsBrushCursor = computed(() =>
  editor.currentTool.value === 'pencil' || editor.currentTool.value === 'eraser'
)

const brushCursorStyle = computed(() => {
  const point = cursorPoint.value
  if (!point) return null
  const scale = pixelSize.value
  const radius = brushRadius.value
  const origin = Math.floor(radius / 2)
  return {
    left: `${(point.x - origin) * scale}px`,
    top: `${(point.y - origin) * scale}px`,
    width: `${radius * scale}px`,
    height: `${radius * scale}px`
  }
})

// A touch screen has no hovering pointer, so there the square only exists
// while a finger is down — otherwise it would be stranded wherever the last
// tap landed.
function trackCursor(event: PointerEvent) {
  if (!showsBrushCursor.value) return
  if (event.pointerType === 'touch' && event.buttons === 0) {
    cursorPoint.value = null
    return
  }
  cursorPoint.value = toGrid(event.clientX, event.clientY)
}

// ─── Tools ──────────────────────────────────────────────────────────────────

const isDrawing = ref(false)
const isErasingWithRightButton = ref(false)
const lastPoint = ref<Point | null>(null)
const isSelecting = ref(false)
const selectionStart = ref<Point | null>(null)

function stampBrush(data: PixelGrid, x: number, y: number, radius: number, color: string) {
  const size = editor.canvasSize.value
  const origin = Math.floor(radius / 2)
  for (let dy = 0; dy < radius; dy++) {
    for (let dx = 0; dx < radius; dx++) {
      const px = x - origin + dx
      const py = y - origin + dy
      if (px >= 0 && px < size && py >= 0 && py < size) data[py]![px] = color
    }
  }
}

// Bresenham between pointer samples: a fast drag reports far-apart positions,
// and stamping only those would leave a dotted stroke.
function strokeLine(data: PixelGrid, from: Point, to: Point, radius: number, color: string) {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  const stepX = from.x < to.x ? 1 : -1
  const stepY = from.y < to.y ? 1 : -1
  let error = dx - dy
  let { x, y } = from

  for (;;) {
    stampBrush(data, x, y, radius, color)
    if (x === to.x && y === to.y) break
    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += stepX
    }
    if (doubled < dx) {
      error += dx
      y += stepY
    }
  }
}

function paintAt(point: Point, erase = false) {
  const layer = editor.currentLayer.value
  if (!layer) return
  const radius = erase || editor.currentTool.value === 'eraser' ? editor.eraserSize.value : editor.brushSize.value
  const color = erase || editor.currentTool.value === 'eraser' ? '' : drawColor.value
  const data = cloneGrid(layer.data)

  if (lastPoint.value) strokeLine(data, lastPoint.value, point, radius, color)
  else stampBrush(data, point.x, point.y, radius, color)

  editor.setLayerData(data)
  lastPoint.value = point
}

function floodFill(start: Point) {
  const layer = editor.currentLayer.value
  if (!layer) return
  const target = layer.data[start.y]?.[start.x] ?? ''
  if (target === drawColor.value) return

  const size = editor.canvasSize.value
  const data = cloneGrid(layer.data)
  const stack: Point[] = [start]

  while (stack.length > 0) {
    const { x, y } = stack.pop()!
    if (x < 0 || x >= size || y < 0 || y >= size) continue
    if (data[y]![x] !== target) continue
    data[y]![x] = drawColor.value
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }

  editor.setLayerData(data, true)
}

function replaceColor(start: Point) {
  const layer = editor.currentLayer.value
  if (!layer) return
  const target = layer.data[start.y]?.[start.x] ?? ''
  if (target === drawColor.value) return
  editor.setLayerData(
    layer.data.map(row => row.map(color => (color === target ? drawColor.value : color))),
    true
  )
}

// Picks from the topmost visible layer, which is what the artist sees.
function pickColor(point: Point) {
  const layers = editor.currentFrame.value?.layers ?? []
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!
    const color = layer.data[point.y]?.[point.x]
    if (layer.opacity > 0 && color) {
      editor.currentColor.value = color
      return
    }
  }
  editor.currentColor.value = '#000000'
}

function applySingleShotTool(point: Point): boolean {
  switch (editor.currentTool.value) {
    case 'eyedropper':
      pickColor(point)
      return true
    case 'fill':
      floodFill(point)
      return true
    case 'replace':
      replaceColor(point)
      return true
    default:
      return false
  }
}

// ─── Pointer events ─────────────────────────────────────────────────────────

// One pointer path for mouse, pen and touch. The original had parallel mouse
// and touch handlers that had already drifted apart (touch cleared the
// clipboard after a paste, mouse kept it); pointer events collapse them.
function onPointerDown(event: PointerEvent) {
  // Space-drag owns the pointer while it is held, or a pan would lay down a
  // stroke on its way past.
  if (spaceHeld.value) return

  const point = toGrid(event.clientX, event.clientY)
  if (!point) return
  canvasRef.value?.setPointerCapture(event.pointerId)

  // Right-drag erases whatever the active tool is — the fastest correction
  // while drawing, and the reason erase isn't gated on the eraser tool here.
  if (event.button === 2) {
    event.preventDefault()
    isDrawing.value = true
    isErasingWithRightButton.value = true
    lastPoint.value = null
    paintAt(point, true)
    return
  }

  if (editor.currentTool.value === 'select') {
    if (editor.clipboard.value && editor.selectionMode.value === 'pasting') {
      editor.commitPaste()
      return
    }
    isSelecting.value = true
    selectionStart.value = point
    editor.selection.value = null
    editor.selectionMode.value = 'selecting'
    return
  }

  if (applySingleShotTool(point)) return

  isDrawing.value = true
  lastPoint.value = null
  paintAt(point)
}

function onPointerMove(event: PointerEvent) {
  trackCursor(event)

  // Paste tracking runs on the document instead, so the stamp keeps following
  // the cursor past the canvas edge.
  if (editor.selectionMode.value === 'pasting' && !isSelecting.value) return

  const point = toGrid(event.clientX, event.clientY)
  if (!point) return

  if (isSelecting.value && selectionStart.value) {
    const start = selectionStart.value
    editor.selection.value = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x) + 1,
      height: Math.abs(point.y - start.y) + 1
    }
    return
  }

  if (!isDrawing.value) return
  if (isErasingWithRightButton.value) {
    paintAt(point, true)
    return
  }
  if (editor.currentTool.value !== 'pencil' && editor.currentTool.value !== 'eraser') return
  paintAt(point)
}

function onPointerUp(event?: PointerEvent) {
  if (event?.pointerType === 'touch') cursorPoint.value = null

  if (isSelecting.value && editor.selection.value) {
    editor.selectionMode.value = 'selected'
    isSelecting.value = false
    selectionStart.value = null
    return
  }
  isSelecting.value = false
  selectionStart.value = null

  if (isDrawing.value) editor.commitCurrentLayer()
  isDrawing.value = false
  isErasingWithRightButton.value = false
  lastPoint.value = null
}

function onPointerLeave() {
  cursorPoint.value = null

  // Not during a paste: the cursor is expected to leave and come back while
  // positioning the stamp.
  if (editor.selectionMode.value === 'pasting') return
  onPointerUp()
}

function trackPasteCursor(event: PointerEvent) {
  const canvas = canvasRef.value
  const stamp = editor.clipboard.value
  if (!canvas || !stamp) return
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor(((event.clientX - rect.left) * (canvas.width / rect.width)) / pixelSize.value)
  const y = Math.floor(((event.clientY - rect.top) * (canvas.height / rect.height)) / pixelSize.value)
  // Centre the stamp on the cursor rather than hanging it off the corner.
  editor.pastePreview.value = {
    x: x - Math.floor(stamp[0]!.length / 2),
    y: y - Math.floor(stamp.length / 2)
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

// Deep, because drawing mutates the pixel arrays inside the frames rather than
// replacing them.
watch(
  [
    () => editor.frames.value,
    () => editor.currentFrameIndex.value,
    () => editor.gridVisible.value,
    () => editor.onionSkin.value,
    () => editor.selection.value,
    () => editor.selectionMode.value,
    () => editor.pastePreview.value,
    pixelSize
  ],
  () => nextTick(paint),
  { deep: true }
)

watch(
  () => editor.selectionMode.value === 'pasting' && Boolean(editor.clipboard.value),
  (isPasting) => {
    if (isPasting) document.addEventListener('pointermove', trackPasteCursor)
    else document.removeEventListener('pointermove', trackPasteCursor)
  }
)

// A backgrounded tab can lose its canvas bitmap (screen sharing and some GPU
// driver resets do this), and nothing in the app's own state changes to trigger
// a repaint — so re-run it when the page comes back.
function repaintOnReturn() {
  if (!document.hidden) requestAnimationFrame(paint)
}

let fitObserver: ResizeObserver | null = null

onMounted(() => {
  measureFitZoom()
  nextTick(paint)
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    fitObserver = new ResizeObserver(measureFitZoom)
    fitObserver.observe(containerRef.value)
  }
  window.addEventListener('resize', measureFitZoom)
  window.addEventListener('keydown', onPanKeyDown)
  window.addEventListener('keyup', onPanKeyUp)
  window.addEventListener('blur', onPanKeyUp2)
  document.addEventListener('visibilitychange', repaintOnReturn)
  window.addEventListener('focus', repaintOnReturn)
})

// Releasing space outside the window never reports a keyup, which would leave
// the area stuck in pan mode.
function onPanKeyUp2() {
  spaceHeld.value = false
  panning.value = false
}

onBeforeUnmount(() => {
  fitObserver?.disconnect()
  window.removeEventListener('resize', measureFitZoom)
  window.removeEventListener('keydown', onPanKeyDown)
  window.removeEventListener('keyup', onPanKeyUp)
  window.removeEventListener('blur', onPanKeyUp2)
  document.removeEventListener('visibilitychange', repaintOnReturn)
  window.removeEventListener('focus', repaintOnReturn)
  document.removeEventListener('pointermove', trackPasteCursor)
})

const selectionHint = computed(() => {
  if (editor.currentTool.value !== 'select') return null
  switch (editor.selectionMode.value) {
    case 'selecting': return t('pixelStitch.canvas.hintSelecting')
    case 'selected': return t('pixelStitch.canvas.hintSelected')
    case 'pasting': return t('pixelStitch.canvas.hintPasting')
    default: return t('pixelStitch.canvas.hintIdle')
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <UAlert
      v-if="selectionHint"
      :description="selectionHint"
      icon="lucide:box-select"
      color="secondary"
      variant="soft"
    />

    <div class="flex min-h-0 flex-1 flex-col gap-3">
      <!-- `grid place-items-center` rather than flex: it keeps a board smaller
           than the area centred while still letting a bigger one scroll off
           both edges, which flex clips at the start. The wheel is claimed here
           and nowhere else, so the side panels keep theirs. -->
      <div
        ref="containerRef"
        class="grid min-h-0 w-full flex-1 place-items-center overflow-auto p-4"
        :class="spaceHeld ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
        @wheel="onWheel"
        @pointerdown="onPanStart"
        @pointermove="onPanMove"
        @pointerup="onPanEnd"
        @pointercancel="onPanEnd"
      >
        <!-- `touch-none` stops a drawing drag from scrolling the page on a
             tablet; `image-rendering: pixelated` keeps the zoom crisp instead
             of blurring artwork pixels into each other. -->
        <!-- Two nested boxes: the outer one carries the scaled size so the
             scroll area knows how big the board actually is (a transform alone
             does not affect layout), the inner one carries the transform so
             the brush cursor scales with the artwork and can still be placed
             in plain artboard pixels. -->
        <div :style="{ width: `${scaledSize}px`, height: `${scaledSize}px` }">
          <div
            ref="boardRef"
            class="relative"
            :style="{ width: `${canvasPixels}px`, height: `${canvasPixels}px`, transform: `scale(${editor.zoom.value})`, transformOrigin: 'top left' }"
          >
          <canvas
            ref="canvasRef"
            :width="canvasPixels"
            :height="canvasPixels"
            class="block touch-none rounded-sm ring-1 ring-default"
            :class="showsBrushCursor ? 'cursor-none' : 'cursor-crosshair'"
            :style="{ imageRendering: 'pixelated' }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onPointerLeave"
            @contextmenu.prevent
          />
          <!-- White outside, dark inside: one stroke alone vanishes over the
               pixel it happens to be covering. -->
            <div
              v-if="showsBrushCursor && brushCursorStyle"
              class="pointer-events-none absolute"
              :style="{ ...brushCursorStyle, boxShadow: '0 0 0 1px #ffffff, inset 0 0 0 1px #18181b' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
