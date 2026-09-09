import type { Layer, LibraryAsset, Point } from '~/composables/patchWorkShop/types'
import { MAX_HISTORY_STEPS, MAX_ZOOM, MIN_ZOOM } from '~/composables/patchWorkShop/types'

function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map(layer => ({ ...layer, position: { ...layer.position } }))
}

function newLayerId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * PatchWorkShop's scene state: the layer stack, selection, zoom/pan, the
 * undo/redo history and the single-layer clipboard. One instance per page,
 * shared with every panel underneath through `usePatchWorkShopContext`.
 */
export function usePatchWorkShop() {
  const layers = ref<Layer[]>([])
  const selectedLayerId = ref<string | null>(null)

  // Returns the live entry, not a copy — the `*Live` mutators below rely on
  // writing straight through to the layer the canvas is already watching.
  function findLayer(id: string | null) {
    return layers.value.find(layer => layer.id === id) ?? null
  }

  const selectedLayer = computed(() => findLayer(selectedLayerId.value))

  const zoom = ref(1)
  const panMode = ref(false)

  function setZoom(next: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  }

  // ─── History ────────────────────────────────────────────────────────────

  const history = ref<Layer[][]>([cloneLayers(layers.value)])
  const historyIndex = ref(0)
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // Skips a push when nothing actually changed, so a click that turns out to
  // be a no-op (e.g. releasing a drag that never moved) doesn't burn a step.
  function pushHistory() {
    const snapshot = cloneLayers(layers.value)
    const current = history.value[historyIndex.value]
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return

    const trimmed = history.value.slice(0, historyIndex.value + 1)
    trimmed.push(snapshot)
    history.value = trimmed.length > MAX_HISTORY_STEPS + 1
      ? trimmed.slice(trimmed.length - MAX_HISTORY_STEPS - 1)
      : trimmed
    historyIndex.value = history.value.length - 1
  }

  function applyHistoryEntry(entry: Layer[]) {
    layers.value = cloneLayers(entry)
    if (!layers.value.some(layer => layer.id === selectedLayerId.value)) selectedLayerId.value = null
  }

  function undo() {
    flushPendingReorder()
    if (!canUndo.value) return
    historyIndex.value -= 1
    applyHistoryEntry(history.value[historyIndex.value]!)
  }

  function redo() {
    flushPendingReorder()
    if (!canRedo.value) return
    historyIndex.value += 1
    applyHistoryEntry(history.value[historyIndex.value]!)
  }

  // ─── Layers ─────────────────────────────────────────────────────────────

  // New layers go on top: last in the array is drawn last, so it's the one
  // that ends up visually on top.
  function addLayer(asset: LibraryAsset, position: Point = { x: 0, y: 0 }) {
    const layer: Layer = {
      id: newLayerId(),
      name: asset.name,
      imageUrl: asset.imageUrl,
      visible: true,
      opacity: 1,
      locked: false,
      position
    }
    layers.value.push(layer)
    selectedLayerId.value = layer.id
    pushHistory()
  }

  function selectLayer(id: string | null) {
    selectedLayerId.value = id
  }

  function deleteLayer(id: string) {
    const index = layers.value.findIndex(layer => layer.id === id)
    if (index === -1) return
    layers.value.splice(index, 1)
    if (selectedLayerId.value === id) selectedLayerId.value = null
    pushHistory()
  }

  function clearAll() {
    layers.value = []
    selectedLayerId.value = null
    pushHistory()
  }

  // The layer list arrives topmost-first from the panel (drag-to-reorder);
  // the canvas paints bottom-first, so store the reverse of what's handed in.
  //
  // motion-v's `ReorderGroup` reports the order continuously as a dragged row
  // passes its neighbours, not just once on drop — applying every one of
  // those as its own history entry would mean a single drag needs several
  // undos to reverse. Reordering settles instead: the array updates live for
  // an immediate redraw, and one history entry lands a beat after the last
  // change, once the drag (or a run of arrow-key presses) has stopped.
  const REORDER_SETTLE_MS = 300
  let reorderSettleTimer: ReturnType<typeof setTimeout> | null = null

  function setLayerOrderTopFirst(topFirst: Layer[]) {
    layers.value = [...topFirst].reverse()
    if (reorderSettleTimer !== null) clearTimeout(reorderSettleTimer)
    reorderSettleTimer = setTimeout(() => {
      reorderSettleTimer = null
      pushHistory()
    }, REORDER_SETTLE_MS)
  }

  // Undo/redo must never leave a just-finished reorder stranded mid-debounce,
  // or it would vanish the moment either ran `applyHistoryEntry`.
  function flushPendingReorder() {
    if (reorderSettleTimer === null) return
    clearTimeout(reorderSettleTimer)
    reorderSettleTimer = null
    pushHistory()
  }

  function toggleLayerVisible(id: string) {
    const layer = findLayer(id)
    if (!layer) return
    layer.visible = !layer.visible
    pushHistory()
  }

  function toggleLayerLocked(id: string) {
    const layer = findLayer(id)
    if (!layer) return
    layer.locked = !layer.locked
    pushHistory()
  }

  // Opacity and position both change continuously (a slider drag, a pointer
  // drag) — mutating live keeps the canvas responsive, and the matching
  // `end*` call folds the whole gesture into one history entry instead of one
  // per intermediate value.
  function setLayerOpacityLive(id: string, opacity: number) {
    const layer = findLayer(id)
    if (!layer) return
    layer.opacity = Math.min(1, Math.max(0, opacity))
  }

  function endLayerOpacity() {
    pushHistory()
  }

  function moveLayerLive(id: string, position: Point) {
    const layer = findLayer(id)
    if (!layer || layer.locked) return
    layer.position = position
  }

  function endLayerMove() {
    pushHistory()
  }

  // Arrow-key nudges are already discrete (one press, one step), so they push
  // straight away rather than needing a matching `end*` call.
  function nudgeLayer(id: string, dx: number, dy: number) {
    const layer = findLayer(id)
    if (!layer || layer.locked) return
    layer.position = { x: layer.position.x + dx, y: layer.position.y + dy }
    pushHistory()
  }

  // ─── Clipboard ──────────────────────────────────────────────────────────

  const clipboard = ref<Layer | null>(null)

  function copySelected() {
    if (!selectedLayer.value) return
    clipboard.value = { ...selectedLayer.value, position: { ...selectedLayer.value.position } }
  }

  // The pasted copy is unlocked regardless of the original's lock state, and
  // nudged so it's visibly a new layer rather than sitting exactly on top of
  // its source.
  const PASTE_OFFSET = 16

  function paste() {
    if (!clipboard.value) return
    const source = clipboard.value
    const layer: Layer = {
      ...source,
      id: newLayerId(),
      locked: false,
      position: { x: source.position.x + PASTE_OFFSET, y: source.position.y + PASTE_OFFSET }
    }
    layers.value.push(layer)
    selectedLayerId.value = layer.id
    pushHistory()
  }

  return {
    layers,
    findLayer,
    selectedLayerId,
    selectedLayer,
    selectLayer,

    zoom,
    setZoom,
    panMode,

    addLayer,
    deleteLayer,
    clearAll,
    setLayerOrderTopFirst,
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacityLive,
    endLayerOpacity,
    moveLayerLive,
    endLayerMove,
    nudgeLayer,

    clipboard,
    copySelected,
    paste,

    canUndo,
    canRedo,
    undo,
    redo
  }
}
