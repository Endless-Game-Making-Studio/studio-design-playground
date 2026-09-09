// Canvas coordinates in logical pixels. Which origin they count from depends
// on where they come from — a layer's position is measured from canvas-center,
// a hit test from the top-left corner — so each field says which it means.
export interface Point {
  x: number
  y: number
}

export interface Layer {
  id: string
  name: string
  imageUrl: string
  visible: boolean
  opacity: number
  locked: boolean
  // Offset from canvas-center, not from the top-left corner — every later
  // ticket (rendering, hit-testing, dragging, nudge) reads position against
  // that same origin, so this has to stay the convention everywhere.
  position: Point
}

export interface LibraryAsset {
  id: string
  name: string
  category: string
  subcategory?: string
  imageUrl: string
}

// A subcategory nav node: either a leaf name, or a named group with its own
// nested children — `Decorations > Clothes > Socks > Left/Right` is three
// levels deep, which is why this recurses rather than staying two-level.
export interface SubcategoryItem {
  name: string
  children?: (string | SubcategoryItem)[]
}

export interface CategoryGroup {
  name: string
  subcategories: (string | SubcategoryItem)[]
}

export const CANVAS_SIZE = 256
export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 4
export const ZOOM_PRESETS = [0.5, 1, 1.5, 2, 3, 4]
export const MAX_HISTORY_STEPS = 50
