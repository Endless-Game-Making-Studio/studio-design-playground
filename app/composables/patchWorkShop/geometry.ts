import type { Layer } from './types'
import { CANVAS_SIZE } from './types'

// A layer's position is stored as an offset from canvas-center (see the
// `Layer.position` doc comment); every consumer that needs the image's actual
// top-left — drawing, the selection outline, hit-testing, PNG export — was
// re-deriving this same formula, so it lives here once instead.
export function layerOrigin(layer: Layer, image: HTMLImageElement): { x: number, y: number } {
  return {
    x: CANVAS_SIZE / 2 - image.width / 2 + layer.position.x,
    y: CANVAS_SIZE / 2 - image.height / 2 + layer.position.y
  }
}
