import type { Layer, LibraryAsset } from '~/composables/patchWorkShop/types'

/**
 * PatchWorkShop's scene state. For now this only covers placing assets — the
 * layer list and the one operation that grows it. Selection, undo/redo and
 * clipboard state land in later tickets (#21, #22) as more exports off this
 * same composable, mirroring how Pixel Stitch's single editor object grew.
 */
export function usePatchWorkShop() {
  const layers = ref<Layer[]>([])

  // New layers go on top: last in the array is drawn last, so it's the one
  // that ends up visually on top.
  function addLayer(asset: LibraryAsset, position: { x: number, y: number } = { x: 0, y: 0 }) {
    const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    layers.value.push({
      id,
      name: asset.name,
      imageUrl: asset.imageUrl,
      visible: true,
      opacity: 1,
      locked: false,
      position
    })
  }

  return {
    layers,
    addLayer
  }
}
