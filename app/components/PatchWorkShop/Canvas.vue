<script setup lang="ts">
import type { LibraryAsset } from '~/composables/patchWorkShop/types'
import { CANVAS_SIZE, MAX_ZOOM, MIN_ZOOM } from '~/composables/patchWorkShop/types'
import { alphaAt, getCachedImage } from '~/composables/patchWorkShop/imageCache'
import { layerOrigin } from '~/composables/patchWorkShop/geometry'
import { usePatchWorkShopContext } from '~/composables/usePatchWorkShopContext'

const editor = usePatchWorkShopContext()
const { t } = useI18n()

const containerRef = ref<HTMLElement | null>(null)
const boardRef = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

function redraw() {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  for (const layer of editor.layers.value) {
    if (!layer.visible) continue
    const image = getCachedImage(layer.imageUrl, redraw)
    if (!image.complete || image.naturalWidth === 0) continue

    const origin = layerOrigin(layer, image)
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(image, origin.x, origin.y)
  }
  ctx.globalAlpha = 1

  const selected = editor.selectedLayer.value
  if (selected) {
    const image = getCachedImage(selected.imageUrl)
    if (image.complete && image.naturalWidth > 0) {
      const { x, y } = layerOrigin(selected, image)
      ctx.strokeStyle = '#3b5bdb'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(x - 1, y - 1, image.width + 2, image.height + 2)
      ctx.setLineDash([])
    }
  }
}

watch(editor.layers, redraw, { deep: true })
watch(() => editor.selectedLayerId.value, redraw)
onMounted(redraw)

// ─── Zoom and panning ───────────────────────────────────────────────────────

const scaledSize = computed(() => CANVAS_SIZE * editor.zoom.value)

// Anchored to the pointer: zooming to the centre of the area makes people
// chase the part they were looking at.
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
  editor.setZoom(next)

  await nextTick()
  const after = board.getBoundingClientRect()
  container.scrollLeft += after.left + u * after.width - event.clientX
  container.scrollTop += after.top + v * after.height - event.clientY
}

const panning = ref(false)
let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 }

function onPanStart(event: PointerEvent) {
  const container = containerRef.value
  if (!container) return
  panning.value = true
  // Captured on the container: its own pointerdown/move/up are what call
  // into this (see onContainerPointer* below), and capturing anywhere else
  // would retarget every later event away from the element listening for it.
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

// ─── Pixel-perfect hit-testing ──────────────────────────────────────────────

// Client coordinates -> canvas logical pixels, undoing both the CSS zoom
// transform and any difference between the canvas's backing resolution and
// its rendered size.
function toCanvasPoint(clientX: number, clientY: number): { x: number, y: number } | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) * (canvas.width / rect.width)),
    y: ((clientY - rect.top) * (canvas.height / rect.height))
  }
}

// Topmost layer first; a transparent pixel passes the hit through to
// whatever's underneath instead of claiming the click for its bounding box.
function hitTestLayer(point: { x: number, y: number }): string | null {
  const layers = editor.layers.value
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!
    if (!layer.visible) continue
    const image = getCachedImage(layer.imageUrl)
    if (!image.complete || image.naturalWidth === 0) continue

    const origin = layerOrigin(layer, image)
    const localX = point.x - origin.x
    const localY = point.y - origin.y
    if (localX < 0 || localY < 0 || localX >= image.width || localY >= image.height) continue
    if (alphaAt(layer.imageUrl, localX, localY) > 0) return layer.id
  }
  return null
}

// ─── Drag to move ───────────────────────────────────────────────────────────

const dragging = ref(false)
let dragStart = { pointerX: 0, pointerY: 0, layerX: 0, layerY: 0 }

function onCanvasPointerDown(event: PointerEvent) {
  // Pan mode is handled by the container (onContainerPointerDown below) so
  // dragging works from the padded backdrop too, not just the canvas itself.
  if (editor.panMode.value) return

  const point = toCanvasPoint(event.clientX, event.clientY)
  const hitId = point ? hitTestLayer(point) : null
  editor.selectLayer(hitId)
  if (!hitId) return

  const layer = editor.layers.value.find(l => l.id === hitId)
  if (!layer || layer.locked) return

  canvasEl.value?.setPointerCapture(event.pointerId)
  dragging.value = true
  dragStart = { pointerX: event.clientX, pointerY: event.clientY, layerX: layer.position.x, layerY: layer.position.y }
}

function onCanvasPointerMove(event: PointerEvent) {
  if (editor.panMode.value) return
  if (!dragging.value || !editor.selectedLayerId.value) return

  const scale = editor.zoom.value
  const dx = (event.clientX - dragStart.pointerX) / scale
  const dy = (event.clientY - dragStart.pointerY) / scale
  editor.moveLayerLive(editor.selectedLayerId.value, {
    x: Math.round(dragStart.layerX + dx),
    y: Math.round(dragStart.layerY + dy)
  })
}

function onCanvasPointerUp(event: PointerEvent) {
  if (editor.panMode.value) return
  if (dragging.value) editor.endLayerMove()
  dragging.value = false
}

// ─── Pan from the backdrop ──────────────────────────────────────────────────

// Bound on the container rather than the canvas: the grab cursor covers the
// whole padded scroll area, so a drag started on that padding — not just on
// the artwork — has to pan too.
function onContainerPointerDown(event: PointerEvent) {
  if (editor.panMode.value) onPanStart(event)
}

function onContainerPointerMove(event: PointerEvent) {
  if (editor.panMode.value) onPanMove(event)
}

function onContainerPointerUp() {
  if (editor.panMode.value) onPanEnd()
}

// ─── Drop to place ──────────────────────────────────────────────────────────

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

// The drop point becomes the new layer's centre, so the coordinate math mirrors
// the draw call above in reverse: screen space -> canvas logical pixels (the
// canvas can render larger or smaller than its 256 logical size) -> an offset
// from canvas-center.
function onDrop(event: DragEvent) {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('application/json')
  const point = toCanvasPoint(event.clientX, event.clientY)
  if (!point || !raw) return

  let asset: LibraryAsset
  try {
    asset = JSON.parse(raw)
  } catch {
    return
  }

  editor.addLayer(asset, {
    x: Math.round(point.x - CANVAS_SIZE / 2),
    y: Math.round(point.y - CANVAS_SIZE / 2)
  })
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex h-full w-full flex-1 items-center justify-center overflow-auto bg-slate-50 p-7"
    :class="editor.panMode.value ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
    @wheel="onWheel"
    @dragover="onDragOver"
    @drop="onDrop"
    @pointerdown="onContainerPointerDown"
    @pointermove="onContainerPointerMove"
    @pointerup="onContainerPointerUp"
    @pointercancel="onContainerPointerUp"
  >
    <div :style="{ width: `${scaledSize}px`, height: `${scaledSize}px` }">
      <div
        ref="boardRef"
        class="relative"
        :style="{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px`, transform: `scale(${editor.zoom.value})`, transformOrigin: 'top left' }"
      >
        <canvas
          ref="canvasEl"
          :width="CANVAS_SIZE"
          :height="CANVAS_SIZE"
          class="block touch-none rounded ring-1 ring-default shadow-xs"
          :class="editor.panMode.value ? '' : 'cursor-default'"
          :style="{ imageRendering: 'pixelated' }"
          :aria-label="t('patchworkshop.canvas.label')"
          @pointerdown="onCanvasPointerDown"
          @pointermove="onCanvasPointerMove"
          @pointerup="onCanvasPointerUp"
          @pointercancel="onCanvasPointerUp"
        />
      </div>
    </div>
  </div>
</template>
