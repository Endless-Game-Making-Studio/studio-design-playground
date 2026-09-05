// A pixel is stored as the CSS color string painted into it, and an empty
// string means transparent — the same shape the original Pixel Stitch used, so
// project files written by either version stay interchangeable.
export type PixelGrid = string[][]

export interface Layer {
  id: number
  name: string
  data: PixelGrid
  visible: boolean
  opacity: number
}

export interface Frame {
  id: number
  layers: Layer[]
}

export interface OnionSkinSettings {
  enabled: boolean
  previousFrames: number
  nextFrames: number
  opacity: number
}

export type PixelTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'replace' | 'select'

export type SelectionMode = 'selecting' | 'selected' | 'pasting' | null

export interface Selection {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface ProjectData {
  version: 1
  canvasSize: number
  fps: number
  currentFrameIndex: number
  frames: Frame[]
}

export const CANVAS_SIZES = [16, 32, 64, 128] as const

// The artboard has a size of its own rather than shrinking to fit the window,
// so opening the animation panel scrolls the area around it instead of
// squeezing the drawing. Every canvas size divides this evenly.
export const ARTBOARD_SIZE = 512

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

// The sizes worth going to directly. Anything between them is what the wheel
// is for, so a value the wheel stopped on ticks nothing in this list.
export const ZOOM_PRESETS = [0.5, 1, 2, 4, 8] as const

// Only the drawing history is capped: 10 undo steps plus the state they started
// from. A pixel grid is a full copy per step, so an unbounded stack would hold
// the whole session's artwork in memory.
export const MAX_HISTORY_STEPS = 10
