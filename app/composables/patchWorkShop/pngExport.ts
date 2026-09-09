import type { Layer } from './types'
import { CANVAS_SIZE } from './types'
import { layerOrigin } from './geometry'
import { loadImage } from '~/composables/files'

/**
 * Flattens every visible layer (respecting opacity and z-order, and never the
 * selection outline — that's canvas-overlay-only and never touches this
 * offscreen surface) onto a fresh canvas at `upscale`x the logical resolution,
 * and resolves to a PNG blob ready to download.
 */
export async function exportCompositionToPng(layers: Layer[], upscale: number): Promise<Blob> {
  const size = CANVAS_SIZE * upscale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.imageSmoothingEnabled = false

  const visible = layers.filter(layer => layer.visible)
  const images = await Promise.all(visible.map(layer => loadImage(layer.imageUrl)))

  visible.forEach((layer, index) => {
    const image = images[index]!
    const origin = layerOrigin(layer, image)
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(image, origin.x * upscale, origin.y * upscale, image.width * upscale, image.height * upscale)
  })
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode PNG'))
    }, 'image/png')
  })
}
