import { hexToRgb } from './project'

export interface Hsv {
  h: number
  s: number
  v: number
}

export type Rgb = [number, number, number]

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function rgbToHsv([r, g, b]: Rgb): Hsv {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const span = max - min

  let h = 0
  if (span !== 0) {
    if (max === red) h = ((green - blue) / span + (green < blue ? 6 : 0)) / 6
    else if (max === green) h = ((blue - red) / span + 2) / 6
    else h = ((red - green) / span + 4) / 6
  }

  return { h, s: max === 0 ? 0 : span / max, v: max }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sector = (((h % 1) + 1) % 1) * 6
  const index = Math.floor(sector)
  const fraction = sector - index
  const p = v * (1 - s)
  const q = v * (1 - s * fraction)
  const t = v * (1 - s * (1 - fraction))

  const table: Rgb[] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q]
  ]
  const picked = table[index % 6]!
  return [Math.round(picked[0] * 255), Math.round(picked[1] * 255), Math.round(picked[2] * 255)]
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function hexToHsv(hex: string): Hsv {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHsv(rgb as Rgb) : { h: 0, s: 0, v: 0 }
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv))
}

/**
 * The pure hue behind the saturation/value square — full saturation and value,
 * so the square's own gradients can lay white and black over it.
 */
export function hueHex(h: number): string {
  return hsvToHex({ h, s: 1, v: 1 })
}

/**
 * Where a pointer landed inside an element, as a 0–1 fraction of each axis.
 * Shared by the square and the hue track, which differ only in which axes they
 * read.
 */
export function fractionWithin(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect()
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height)
  }
}
