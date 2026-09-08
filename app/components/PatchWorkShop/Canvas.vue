<script setup lang="ts">
import type { LibraryAsset } from '~/composables/patchWorkShop/types'
import { usePatchWorkShopContext } from '~/composables/usePatchWorkShopContext'

const editor = usePatchWorkShopContext()

// The source app's `Canvas` component defaults its `size` prop to 512, but the
// PatchWorkShop page itself renders it at 256 — that's the logical resolution
// every position and drop coordinate here has to agree with.
const CANVAS_SIZE = 256

const canvasEl = ref<HTMLCanvasElement | null>(null)

// One `HTMLImageElement` per unique `imageUrl`, shared across layers that
// repeat an asset. Draws before an image finishes loading skip it; the image's
// own `onload` schedules the redraw that picks it up.
const imageCache = new Map<string, HTMLImageElement>()

function getImage(url: string): HTMLImageElement {
  const cached = imageCache.get(url)
  if (cached) return cached
  const image = new Image()
  image.src = url
  image.onload = () => redraw()
  imageCache.set(url, image)
  return image
}

function redraw() {
  const canvas = canvasEl.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  for (const layer of editor.layers.value) {
    if (!layer.visible) continue
    const image = getImage(layer.imageUrl)
    if (!image.complete || image.naturalWidth === 0) continue

    ctx.globalAlpha = layer.opacity
    ctx.drawImage(
      image,
      CANVAS_SIZE / 2 - image.width / 2 + layer.position.x,
      CANVAS_SIZE / 2 - image.height / 2 + layer.position.y
    )
  }
  ctx.globalAlpha = 1
}

watch(editor.layers, redraw, { deep: true })
onMounted(redraw)

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
  const canvas = canvasEl.value
  const raw = event.dataTransfer?.getData('application/json')
  if (!canvas || !raw) return

  let asset: LibraryAsset
  try {
    asset = JSON.parse(raw)
  } catch {
    return
  }

  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_SIZE / rect.width
  const scaleY = CANVAS_SIZE / rect.height
  const canvasX = (event.clientX - rect.left) * scaleX
  const canvasY = (event.clientY - rect.top) * scaleY

  editor.addLayer(asset, {
    x: Math.round(canvasX - CANVAS_SIZE / 2),
    y: Math.round(canvasY - CANVAS_SIZE / 2)
  })
}
</script>

<template>
  <div
    class="flex h-full w-full flex-1 items-center justify-center bg-slate-50 p-7"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <canvas
      ref="canvasEl"
      :width="CANVAS_SIZE"
      :height="CANVAS_SIZE"
      class="rounded ring-1 ring-default shadow-xs"
      style="image-rendering: pixelated"
    />
  </div>
</template>
