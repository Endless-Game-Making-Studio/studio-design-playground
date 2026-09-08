// One `HTMLImageElement` (plus its decoded pixel data, for hit-testing) per
// unique `imageUrl`, shared across every layer that repeats an asset and
// across the canvas's draw pass and its hit-test pass alike — decoding twice
// per asset would be wasted work and would desync "what's drawn" from "what's
// clickable".
interface CacheEntry {
  image: HTMLImageElement
  imageData: ImageData | null
}

const cache = new Map<string, CacheEntry>()

export function getCachedImage(url: string, onLoad?: () => void): HTMLImageElement {
  const existing = cache.get(url)
  if (existing) return existing.image

  const image = new Image()
  const entry: CacheEntry = { image, imageData: null }
  cache.set(url, entry)

  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(image, 0, 0)
      entry.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
    onLoad?.()
  }
  image.src = url
  return image
}

// Alpha channel at a pixel local to the image's own bounds (0,0 = top-left),
// used to let a click on a transparent pixel fall through to the layer below
// instead of selecting whatever's bounding box happens to cover it.
export function alphaAt(url: string, localX: number, localY: number): number {
  const data = cache.get(url)?.imageData
  if (!data) return 0
  const x = Math.floor(localX)
  const y = Math.floor(localY)
  if (x < 0 || y < 0 || x >= data.width || y >= data.height) return 0
  return data.data[(y * data.width + x) * 4 + 3] ?? 0
}
