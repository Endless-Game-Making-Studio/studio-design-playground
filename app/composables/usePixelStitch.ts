import type {
  Frame,
  Layer,
  PixelGrid,
  PixelTool,
  Point,
  ProjectData,
  Selection,
  SelectionMode
} from '~/composables/pixelStitch/types'
import { MAX_HISTORY_STEPS, MAX_ZOOM, MIN_ZOOM } from '~/composables/pixelStitch/types'
import {
  DEFAULT_PALETTE,
  cloneGrid,
  createFrame,
  createLayer,
  emptyGrid,
  hexToRgb
} from '~/composables/pixelStitch/project'
import {
  loadPalette,
  loadProject,
  savePalette,
  saveProject
} from '~/composables/pixelStitch/persistence'
import type { ProjectData as SavedProject } from '~/composables/pixelStitch/types'

interface HistoryEntry {
  frameIndex: number
  layerIndex: number
  data: PixelGrid
}

/**
 * All of one project's editor state and the operations that mutate it. Each
 * open tab owns one instance and hands slices of it to the panels, mirroring
 * the original's single-container-component shape — every tool acts on the same
 * frame/layer cursor, so splitting the state per panel would just mean threading
 * it back together.
 */
export interface PixelStitchOptions {
  /**
   * The project this editor restores on mount and autosaves to. Without one
   * nothing is read or written — that is Storybook, where a story seeding its
   * own artwork would otherwise overwrite a real project.
   */
  projectId?: string
  /** Called after each autosave lands, with what was written. */
  onSave?: (data: SavedProject) => void
}

export function usePixelStitch(options: PixelStitchOptions = {}) {
  const { projectId, onSave } = options
  const persist = !!projectId
  const { t } = useI18n()

  // ─── Notices ──────────────────────────────────────────────────────────────

  /**
   * The editor's own notice line, shown along the foot of the canvas area
   * rather than as a toast. A toast for every layer added and colour saved is
   * a lot of stacked cards over the drawing for events the artist just caused;
   * one discreet line that replaces itself says the same thing without taking
   * the screen.
   */
  const notice = ref<{ id: number, text: string, color: 'success' | 'error' | 'info' } | null>(null)
  let noticeTimer: ReturnType<typeof setTimeout> | null = null
  let noticeSerial = 0

  // Long enough to read, short enough that the line is usually empty. Errors
  // stay longer: they are the ones worth catching up on.
  const NOTICE_MS = 2600
  const NOTICE_ERROR_MS = 5000

  function showNotice(text: string, color: 'success' | 'error' | 'info' = 'success') {
    if (noticeTimer) clearTimeout(noticeTimer)
    notice.value = { id: ++noticeSerial, text, color }
    noticeTimer = setTimeout(() => {
      notice.value = null
      noticeTimer = null
    }, color === 'error' ? NOTICE_ERROR_MS : NOTICE_MS)
  }

  function notify(key: string, color: 'success' | 'error' | 'info' = 'success') {
    showNotice(t(`pixelStitch.toast.${key}`), color)
  }

  onBeforeUnmount(() => {
    if (noticeTimer) clearTimeout(noticeTimer)
  })

  // ─── Document state ───────────────────────────────────────────────────────

  const canvasSize = ref(32)
  const frames = ref<Frame[]>([createFrame(32, 1)])
  const currentFrameIndex = ref(0)
  const currentLayerIndex = ref(0)
  const fps = ref(8)

  const currentFrame = computed(() => frames.value[currentFrameIndex.value])
  const currentLayer = computed(() => currentFrame.value?.layers[currentLayerIndex.value])

  // ─── Tool state ───────────────────────────────────────────────────────────

  const currentColor = ref('#FF00FF')
  const currentTool = ref<PixelTool>('pencil')
  const brushSize = ref(1)
  const eraserSize = ref(1)
  const gridVisible = ref(true)
  const zoom = ref(1)

  // Measured by the canvas, which is the only part that knows how big its
  // scroll area is; the zoom control in the top bar reads it for its
  // fit-to-window preset.
  const fitZoom = ref(1)

  function setZoom(value: number) {
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  }
  // One palette for every project: the colours an artist saved are theirs, not
  // a drawing's. Shared state rather than a per-editor ref, so a colour added
  // in one tab is already there in the next.
  const palette = useState<string[][]>('pixel-stitch-palette', () => DEFAULT_PALETTE.map(row => [...row]))
  const paletteLoaded = useState('pixel-stitch-palette-loaded', () => false)

  const isPlaying = ref(false)

  // Whether the animation panel along the bottom is open. It lives here rather
  // than in the panel because the page's own bottom padding has to clear it.
  const animationPanelOpen = ref(false)

  // Playback lives with the state rather than inside the preview component:
  // play stays available while the panel is closed and the preview is not
  // mounted. It advances the shared frame cursor, so the canvas and the strip
  // follow along — nothing here is a separate player.
  let playbackTimer: ReturnType<typeof setInterval> | null = null

  function stopPlayback() {
    if (playbackTimer) clearInterval(playbackTimer)
    playbackTimer = null
  }

  watch(
    [isPlaying, fps, () => frames.value.length],
    ([playing, rate, frameCount]) => {
      stopPlayback()
      if (!playing || frameCount < 2) return
      // Re-created whenever fps changes, which is what lets the drag retime a
      // running animation instead of waiting for the next play.
      playbackTimer = setInterval(() => {
        currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.value.length
      }, 1000 / rate)
    },
    { immediate: true }
  )

  onBeforeUnmount(stopPlayback)

  // On or off, nothing else. Two ghost colours carry one neighbour each way;
  // reaching further needs either fading the more distant ghosts in the same
  // colour or more tones on the strip, which is a separate decision.
  const onionSkin = ref(false)

  const selection = ref<Selection | null>(null)
  const clipboard = ref<PixelGrid | null>(null)
  const pastePreview = ref<Point | null>(null)
  const selectionMode = ref<SelectionMode>(null)

  // ─── History ──────────────────────────────────────────────────────────────

  const history = ref<HistoryEntry[]>([])
  const historyIndex = ref(-1)
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  function pushHistory(data: PixelGrid) {
    const trimmed = history.value.slice(0, historyIndex.value + 1)
    trimmed.push({
      frameIndex: currentFrameIndex.value,
      layerIndex: currentLayerIndex.value,
      data: cloneGrid(data)
    })
    // Keep one extra entry: the oldest is the state undo returns *to*, not a
    // step of its own.
    history.value = trimmed.length > MAX_HISTORY_STEPS + 1
      ? trimmed.slice(trimmed.length - MAX_HISTORY_STEPS - 1)
      : trimmed
    historyIndex.value = history.value.length - 1
  }

  function resetHistory(data: PixelGrid) {
    history.value = [{ frameIndex: 0, layerIndex: 0, data: cloneGrid(data) }]
    historyIndex.value = 0
  }

  function applyHistoryEntry(entry: HistoryEntry) {
    const layer = frames.value[entry.frameIndex]?.layers[entry.layerIndex]
    if (!layer) return
    layer.data = cloneGrid(entry.data)
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value -= 1
    applyHistoryEntry(history.value[historyIndex.value]!)
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value += 1
    applyHistoryEntry(history.value[historyIndex.value]!)
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  // The single write path for pixel data. `commit` marks the end of a gesture:
  // a drag paints continuously but only lands one undo step, when the pointer
  // comes up.
  function setLayerData(data: PixelGrid, commit = false) {
    const layer = currentLayer.value
    if (!layer) return
    layer.data = data
    if (commit) pushHistory(data)
  }

  function commitCurrentLayer() {
    const layer = currentLayer.value
    if (layer) pushHistory(layer.data)
  }

  // ─── Layers ───────────────────────────────────────────────────────────────

  function addLayer() {
    const frame = currentFrame.value
    if (!frame) return

    // Names count up from the highest "Layer N" already in the stack, so
    // deleting the middle of a list does not hand the next layer a number that
    // is already taken. The id is separate and only has to be unique.
    const highestNumber = frame.layers.reduce((highest, layer) => {
      const match = /^Layer (\d+)$/.exec(layer.name)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, frame.layers.length)
    const nextId = frame.layers.reduce((highest, layer) => Math.max(highest, layer.id), 0) + 1

    frame.layers.push(createLayer(canvasSize.value, nextId, `Layer ${highestNumber + 1}`))
    currentLayerIndex.value = frame.layers.length - 1
    notify('layerAdded')
  }

  function deleteLayer(index: number) {
    const frame = currentFrame.value
    if (!frame) return
    if (frame.layers.length === 1) {
      notify('cannotDeleteLastLayer', 'error')
      return
    }
    frame.layers.splice(index, 1)
    currentLayerIndex.value = Math.min(currentLayerIndex.value, frame.layers.length - 1)
    notify('layerDeleted')
  }

  // What a layer was at before it was hidden. Deliberately not part of the
  // project: 45% coming back as 45% is a convenience within a session, not a
  // second piece of state a saved file has to agree about.
  const opacityBeforeHiding = new Map<number, number>()

  function toggleLayerHidden(index: number) {
    const layer = currentFrame.value?.layers[index]
    if (!layer) return
    if (layer.opacity > 0) {
      opacityBeforeHiding.set(layer.id, layer.opacity)
      layer.opacity = 0
      return
    }
    layer.opacity = opacityBeforeHiding.get(layer.id) ?? 1
  }

  function setLayerOpacity(index: number, opacity: number) {
    const layer = currentFrame.value?.layers[index]
    if (layer) layer.opacity = opacity
  }

  function renameLayer(index: number, name: string) {
    const layer = currentFrame.value?.layers[index]
    if (layer) layer.name = name
  }

  // Absolute rather than a one-step nudge: the arrow keys on the grip know the
  // position they want to land on.
  function reorderLayer(from: number, to: number) {
    const layers = currentFrame.value?.layers
    if (!layers || from === to || to < 0 || to >= layers.length) return
    const [moved] = layers.splice(from, 1)
    layers.splice(to, 0, moved!)
    currentLayerIndex.value = to
  }

  // The drag reports the order it arrived at rather than a pair of indices, and
  // it reports it continuously while the pointer moves. Selection follows the
  // layer itself, not its old position, so the row someone is holding stays the
  // selected one as it travels.
  function setLayerOrder(next: Layer[]) {
    const frame = currentFrame.value
    if (!frame) return

    // A reorder is a permutation and nothing else. The drag reports the order
    // its own layout measurements know about, and a row added moments earlier
    // may not have been measured yet — taking that array at face value dropped
    // the unmeasured layer from the project.
    const ids = new Set(frame.layers.map(layer => layer.id))
    const isPermutation = next.length === ids.size && next.every(layer => ids.has(layer.id))
    if (!isPermutation) return

    const selected = frame.layers[currentLayerIndex.value]
    frame.layers = next
    const found = selected ? next.findIndex(layer => layer.id === selected.id) : -1
    if (found !== -1) currentLayerIndex.value = found
  }

  function clearLayer() {
    setLayerData(emptyGrid(canvasSize.value), true)
    notify('layerCleared')
  }

  // Undo only brings back the layer that was selected: a history entry names a
  // single frame and layer, so a change spanning the whole stack can't be
  // recorded as one step. Inherited from the original, and the reason this is
  // offered as a separate menu item rather than as the default clear.
  function clearAllLayers() {
    const frame = currentFrame.value
    if (!frame) return
    for (const layer of frame.layers) layer.data = emptyGrid(canvasSize.value)
    commitCurrentLayer()
    notify('allLayersCleared')
  }

  // ─── Frames ───────────────────────────────────────────────────────────────

  function addFrame() {
    frames.value.push(createFrame(canvasSize.value, Date.now()))
    currentFrameIndex.value = frames.value.length - 1
    currentLayerIndex.value = 0
    notify('frameAdded')
  }

  function deleteFrame(index: number) {
    if (frames.value.length === 1) {
      notify('cannotDeleteLastFrame', 'error')
      return
    }
    frames.value.splice(index, 1)
    currentFrameIndex.value = Math.min(currentFrameIndex.value, frames.value.length - 1)
    currentLayerIndex.value = 0
    notify('frameDeleted')
  }

  function duplicateFrame(index: number) {
    const source = frames.value[index]
    if (!source) return
    frames.value.splice(index + 1, 0, {
      id: Date.now(),
      layers: source.layers.map((layer, offset) => ({
        ...layer,
        id: Date.now() + offset,
        data: cloneGrid(layer.data)
      }))
    })
    currentFrameIndex.value = index + 1
    notify('frameDuplicated')
  }

  function reorderFrames(from: number, to: number) {
    if (from === to) return
    const [moved] = frames.value.splice(from, 1)
    if (!moved) return
    frames.value.splice(to, 0, moved)
    // Follow whichever frame the artist was editing rather than the index.
    if (currentFrameIndex.value === from) currentFrameIndex.value = to
    else if (from < currentFrameIndex.value && to >= currentFrameIndex.value) currentFrameIndex.value -= 1
    else if (from > currentFrameIndex.value && to <= currentFrameIndex.value) currentFrameIndex.value += 1
  }

  function selectFrame(index: number) {
    currentFrameIndex.value = index
    currentLayerIndex.value = 0
  }

  // ─── Canvas transforms ────────────────────────────────────────────────────

  function flipHorizontal() {
    const layer = currentLayer.value
    if (!layer) return
    setLayerData(layer.data.map(row => [...row].reverse()), true)
    notify('flippedHorizontal')
  }

  function flipVertical() {
    const layer = currentLayer.value
    if (!layer) return
    setLayerData([...layer.data].reverse().map(row => [...row]), true)
    notify('flippedVertical')
  }

  // Removes whichever color dominates the layer's border, plus anything close
  // enough to it to be an anti-aliased edge of the same background — an
  // imported PNG rarely has one exact background value.
  const BACKGROUND_TOLERANCE = 48

  function removeBackground() {
    const layer = currentLayer.value
    if (!layer) return
    const size = canvasSize.value
    const counts: Record<string, number> = {}
    const tally = (color?: string) => {
      if (!color) return
      const key = color.toUpperCase()
      counts[key] = (counts[key] ?? 0) + 1
    }

    const last = size - 1
    for (let i = 0; i < size; i++) {
      tally(layer.data[0]?.[i])
      tally(layer.data[last]?.[i])
      tally(layer.data[i]?.[0])
      tally(layer.data[i]?.[last])
    }

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (ranked.length === 0) {
      notify('nothingToRemove', 'info')
      return
    }

    const backgroundColor = ranked[0]![0]
    const backgroundRgb = hexToRgb(backgroundColor)

    setLayerData(
      layer.data.map(row => row.map((color) => {
        if (!color) return color
        if (color.toUpperCase() === backgroundColor) return ''
        const rgb = backgroundRgb && hexToRgb(color)
        if (!rgb || !backgroundRgb) return color
        const distance = Math.hypot(rgb[0] - backgroundRgb[0], rgb[1] - backgroundRgb[1], rgb[2] - backgroundRgb[2])
        return distance <= BACKGROUND_TOLERANCE ? '' : color
      })),
      true
    )
    notify('backgroundRemoved')
  }

  // ─── Canvas size ──────────────────────────────────────────────────────────

  // Resizing starts over: pixel art can't be rescaled between grids without
  // either resampling or cropping, and the original chose a clean slate.
  // Every frame, not just the one on screen — which is the whole point of
  // asking before a resize.
  const hasArtwork = computed(() =>
    frames.value.some(frame => frame.layers.some(layer => layer.data.some(row => row.some(pixel => pixel !== ''))))
  )

  function setCanvasSize(size: number) {
    if (size === canvasSize.value) return
    canvasSize.value = size
    for (const frame of frames.value) {
      for (const layer of frame.layers) layer.data = emptyGrid(size)
    }
    resetHistory(currentLayer.value?.data ?? emptyGrid(size))
    showNotice(t('pixelStitch.toast.canvasSizeChanged', { size: `${size}×${size}` }))
  }

  // ─── Palette ──────────────────────────────────────────────────────────────

  function setPaletteColor(rowIndex: number, slotIndex: number, color: string) {
    const row = palette.value[rowIndex]
    if (!row) return
    row[slotIndex] = color
    notify('colorAddedToPalette')
  }

  // The trailing slot on every row is empty, so a colour can be put somewhere
  // rather than only over something. Appending refills it, which is what keeps
  // an empty slot at the end however long the row gets.
  function addPaletteColor(rowIndex: number, color: string) {
    const row = palette.value[rowIndex]
    if (!row) return
    row.push(color)
    notify('colorAddedToPalette')
  }

  // ─── Selection / clipboard ────────────────────────────────────────────────

  function cancelSelection() {
    selection.value = null
    pastePreview.value = null
    clipboard.value = null
    selectionMode.value = null
  }

  function copySelection(cut = false) {
    const area = selection.value
    const layer = currentLayer.value
    if (!area || !layer || selectionMode.value !== 'selected') return

    const copied: PixelGrid = []
    for (let y = area.y; y < area.y + area.height; y++) {
      const row: string[] = []
      for (let x = area.x; x < area.x + area.width; x++) row.push(layer.data[y]?.[x] ?? '')
      copied.push(row)
    }

    if (cut) {
      const data = cloneGrid(layer.data)
      for (let y = area.y; y < area.y + area.height; y++) {
        for (let x = area.x; x < area.x + area.width; x++) {
          if (data[y]?.[x] !== undefined) data[y]![x] = ''
        }
      }
      setLayerData(data, true)
    }

    clipboard.value = copied
    selectionMode.value = 'pasting'
    pastePreview.value = { x: area.x, y: area.y }
    notify(cut ? 'cutMoveToPos' : 'copiedMoveToPos')
  }

  function beginPaste() {
    if (!clipboard.value || currentTool.value !== 'select') return
    selectionMode.value = 'pasting'
    pastePreview.value = { x: 0, y: 0 }
    notify('moveMouseToPaste')
  }

  // Pasting keeps the clipboard so the same stamp can be dropped repeatedly.
  function commitPaste() {
    const layer = currentLayer.value
    const stamp = clipboard.value
    const at = pastePreview.value
    if (!layer || !stamp || !at) return

    const size = canvasSize.value
    const data = cloneGrid(layer.data)
    for (let y = 0; y < stamp.length; y++) {
      for (let x = 0; x < stamp[y]!.length; x++) {
        const color = stamp[y]![x]
        if (!color) continue
        const targetX = at.x + x
        const targetY = at.y + y
        if (targetX >= 0 && targetX < size && targetY >= 0 && targetY < size) data[targetY]![targetX] = color
      }
    }
    setLayerData(data, true)
    selection.value = null
  }

  // Leaving the select tool drops any in-flight selection — every other tool
  // draws, and a stale marquee would sit on the canvas with nothing acting on it.
  watch(currentTool, (tool) => {
    if (tool !== 'select') cancelSelection()
  })

  watch(selectionMode, (mode) => {
    if (mode === 'selected') notify('selectionMade')
  })

  // ─── Load / save ──────────────────────────────────────────────────────────

  function toProjectData(): ProjectData {
    return {
      version: 1,
      canvasSize: canvasSize.value,
      fps: fps.value,
      currentFrameIndex: currentFrameIndex.value,
      frames: frames.value
    }
  }

  function applyProjectData(data: ProjectData) {
    // Files written before hiding became zero carry a `visible` flag; a layer
    // saved as hidden has to stay hidden rather than reappear at full strength.
    for (const frame of data.frames) {
      for (const layer of frame.layers) {
        const legacy = layer as typeof layer & { visible?: boolean }
        if (legacy.visible === false) layer.opacity = 0
        delete legacy.visible
      }
    }

    frames.value = data.frames
    canvasSize.value = data.canvasSize
    fps.value = data.fps
    currentFrameIndex.value = Math.min(data.currentFrameIndex, data.frames.length - 1)
    currentLayerIndex.value = 0
    resetHistory(data.frames[0]!.layers[0]!.data)
  }

  // Restoring happens on mount rather than in the refs' initialisers because
  // localStorage doesn't exist during SSR — the server would render one
  // document and the client would hydrate a different one. The history still
  // needs seeding when persistence is off, or the first undo has nothing to
  // return to.
  onMounted(async () => {
    const saved = projectId ? loadProject(projectId) : null
    if (saved) applyProjectData(saved)
    else resetHistory(currentLayer.value?.data ?? emptyGrid(canvasSize.value))

    if (persist && !paletteLoaded.value) {
      paletteLoaded.value = true
      const savedPalette = loadPalette()
      if (savedPalette?.length) palette.value = savedPalette
    }

    // Restoring writes into the refs the autosave watches, but it is not an
    // edit. Saving it back would mark the project "edited just now" every time
    // its tab opens, and reorder the start screen's list a second later.
    await nextTick()
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  })

  // Autosave is debounced because it serialises every pixel of every frame, and
  // a drag mutates the grid on each pointer move.
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  // A failed save is said once per run of failures, not on every stroke — the
  // notice line would otherwise repeat the same error as long as someone draws.
  let saveFailing = false

  function saveNow() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = null
    if (!projectId) return
    const data = toProjectData()
    if (saveProject(projectId, data)) {
      saveFailing = false
      onSave?.(data)
    } else if (!saveFailing) {
      saveFailing = true
      notify('storageFull', 'error')
    }
  }

  watch([frames, canvasSize, fps, currentFrameIndex], () => {
    if (!persist) return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(saveNow, 1000)
  }, { deep: true })

  watch(palette, (value) => {
    if (persist) savePalette(value.map(row => [...row]))
  }, { deep: true })

  // Closing a tab unmounts its editor. A change still waiting on the debounce
  // is written now, or a stroke made in the last second would be lost.
  onBeforeUnmount(() => {
    if (autoSaveTimer) saveNow()
  })

  return {
    // notices
    notice,
    notify,
    showNotice,
    // document
    canvasSize,
    frames,
    currentFrameIndex,
    currentLayerIndex,
    currentFrame,
    currentLayer,
    fps,
    // tools
    currentColor,
    currentTool,
    brushSize,
    eraserSize,
    gridVisible,
    zoom,
    fitZoom,
    setZoom,
    palette,
    isPlaying,
    animationPanelOpen,
    onionSkin,
    selection,
    clipboard,
    pastePreview,
    selectionMode,
    // history
    canUndo,
    canRedo,
    undo,
    redo,
    setLayerData,
    commitCurrentLayer,
    resetHistory,
    // layers
    addLayer,
    deleteLayer,
    toggleLayerHidden,
    setLayerOpacity,
    renameLayer,
    reorderLayer,
    setLayerOrder,
    clearLayer,
    clearAllLayers,
    // frames
    addFrame,
    deleteFrame,
    duplicateFrame,
    reorderFrames,
    selectFrame,
    // transforms
    flipHorizontal,
    flipVertical,
    removeBackground,
    hasArtwork,
    setCanvasSize,
    setPaletteColor,
    addPaletteColor,
    // selection
    cancelSelection,
    copySelection,
    beginPaste,
    commitPaste,
    // project
    toProjectData,
    applyProjectData
  }
}
