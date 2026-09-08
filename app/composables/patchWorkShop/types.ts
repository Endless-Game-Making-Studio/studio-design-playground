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
  position: { x: number, y: number }
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
