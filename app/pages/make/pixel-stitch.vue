<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { usePixelStitch } from '~/composables/usePixelStitch'
import { providePixelStitch } from '~/composables/usePixelStitchContext'
import { emptyGrid } from '~/composables/pixelStitch/project'
import { downloadBlob, downloadDataUrl, loadImage, pickFile, readFileAsDataUrl } from '~/composables/pixelStitch/files'
import { downloadProjectFile, openProjectFile } from '~/composables/pixelStitch/persistence'
import { frameToBlob } from '~/composables/pixelStitch/render'
import { exportAsGif } from '~/composables/pixelStitch/gifExport'
import { exportSpriteSheet, importSpriteSheet } from '~/composables/pixelStitch/spriteSheet'

definePageMeta({ layout: false })

const { t } = useI18n()
const editor = usePixelStitch()
providePixelStitch(editor)

// ─── Export / import ────────────────────────────────────────────────────────

async function exportPng() {
  const frame = editor.currentFrame.value
  if (!frame) return
  const blob = await frameToBlob(frame, editor.canvasSize.value)
  if (!blob) return
  downloadBlob(blob, `pixel-art-frame-${editor.currentFrameIndex.value + 1}.png`)
  editor.notify('frameExported')
}

const isExporting = ref(false)
const exportProgress = ref(0)

async function exportGif() {
  if (editor.frames.value.length === 1) {
    editor.notify('addMoreFrames', 'error')
    return
  }
  isExporting.value = true
  exportProgress.value = 0
  try {
    const blob = await exportAsGif(
      editor.frames.value,
      editor.canvasSize.value,
      editor.fps.value,
      progress => (exportProgress.value = progress * 100)
    )
    downloadBlob(blob, 'pixel-art-animation.gif')
    editor.notify('gifExported')
  } catch {
    editor.notify('failedToExportGif', 'error')
  } finally {
    isExporting.value = false
    exportProgress.value = 0
  }
}

// Imports rasterise the picked image down to the current grid with smoothing
// off, so a photo lands as blocky pixels rather than a blurred average.
async function importImage() {
  const file = await pickFile('image/*')
  if (!file) return
  try {
    const image = await loadImage(await readFileAsDataUrl(file))
    const size = editor.canvasSize.value
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0, size, size)

    const { data } = ctx.getImageData(0, 0, size, size)
    const grid = emptyGrid(size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4
        // Half-transparent and below becomes empty: the grid has no alpha
        // channel of its own, so a pixel is either painted or it isn't.
        if (data[offset + 3]! <= 128) continue
        const hex = [data[offset]!, data[offset + 1]!, data[offset + 2]!]
          .map(channel => channel.toString(16).padStart(2, '0'))
          .join('')
        grid[y]![x] = `#${hex}`.toUpperCase()
      }
    }
    editor.setLayerData(grid, true)
    editor.notify('imageImported')
  } catch {
    editor.notify('failedToImport', 'error')
  }
}

// ─── Sprite sheets ──────────────────────────────────────────────────────────

const sheetModalOpen = ref(false)
const sheetMode = ref<'export' | 'import'>('export')

function openSheetModal(mode: 'export' | 'import') {
  sheetMode.value = mode
  sheetModalOpen.value = true
}

async function onExportSheet(columns: number) {
  try {
    const dataUrl = exportSpriteSheet(editor.frames.value, editor.canvasSize.value, columns)
    await downloadDataUrl(dataUrl, 'sprite-sheet.png')
    editor.notify('spriteSheetExported')
  } catch {
    editor.notify('failedToExportSpriteSheet', 'error')
  }
}

async function onImportSheet(file: File, columns: number, rows: number) {
  try {
    const image = await loadImage(await readFileAsDataUrl(file))
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0)

    const imported = importSpriteSheet(
      ctx.getImageData(0, 0, image.width, image.height),
      {
        columns,
        rows,
        frameWidth: Math.floor(image.width / columns),
        frameHeight: Math.floor(image.height / rows)
      },
      editor.canvasSize.value
    )
    if (imported.length === 0) return

    editor.frames.value = imported
    editor.currentFrameIndex.value = 0
    editor.currentLayerIndex.value = 0
    editor.resetHistory(imported[0]!.layers[0]!.data)
    toastImported(imported.length)
  } catch {
    editor.notify('failedToImportSpriteSheet', 'error')
  }
}

const toast = useToast()
function toastImported(count: number) {
  toast.add({ title: t('pixelStitch.toast.importedFrames', { count }), color: 'success' })
}

// ─── Project file ───────────────────────────────────────────────────────────

function saveProjectFile() {
  downloadProjectFile(editor.toProjectData())
  editor.notify('projectSaved')
}

async function loadProject() {
  const data = await openProjectFile()
  if (!data) return
  editor.applyProjectData(data)
  editor.notify('projectLoaded')
}

const importItems = computed<DropdownMenuItem[]>(() => [
  { label: t('pixelStitch.openProject'), icon: 'lucide:folder-open', onSelect: loadProject },
  { label: t('pixelStitch.toolbar.importImage'), icon: 'lucide:image-plus', onSelect: importImage },
  { label: t('pixelStitch.toolbar.importSpriteSheet'), icon: 'lucide:grid-2x2-check', onSelect: () => openSheetModal('import') }
])

const saveItems = computed<DropdownMenuItem[]>(() => [
  { label: t('pixelStitch.saveProject'), icon: 'lucide:save', onSelect: saveProjectFile },
  { label: t('pixelStitch.toolbar.exportPng'), icon: 'lucide:image-down', onSelect: exportPng },
  { label: t('pixelStitch.toolbar.exportGif'), icon: 'lucide:file-image', onSelect: exportGif },
  { label: t('pixelStitch.toolbar.exportSpriteSheet'), icon: 'lucide:grid-2x2-plus', onSelect: () => openSheetModal('export') }
])

// ─── Keyboard ───────────────────────────────────────────────────────────────

// Bound to the window rather than the canvas: the shortcuts have to work while
// focus sits in a layer-name field or on a toolbar button, which is where it
// usually is between strokes.
function onKeyDown(event: KeyboardEvent) {
  const meta = event.ctrlKey || event.metaKey

  if (meta && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  } else if (meta && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    event.preventDefault()
    editor.redo()
  } else if (event.key === 'Escape') {
    editor.cancelSelection()
    editor.notify('selectionCancelled', 'info')
  } else if (meta && (event.key === 'c' || event.key === 'x')) {
    if (editor.selectionMode.value !== 'selected') return
    event.preventDefault()
    editor.copySelection(event.key === 'x')
  } else if (meta && event.key === 'v') {
    if (!editor.clipboard.value || editor.currentTool.value !== 'select') return
    event.preventDefault()
    editor.beginPaste()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-slate-50 pb-52 lg:h-dvh lg:overflow-hidden lg:pb-52">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-slate-100 px-3 py-2 sm:px-4">
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <UButton to="/make" icon="lucide:arrow-left" :label="t('pixelStitch.backToTools')" color="neutral" variant="ghost" size="sm" />
        <USeparator orientation="vertical" class="hidden h-7 sm:block" />
        <PixelStitchCanvasSizeSelector compact />
        <USeparator orientation="vertical" class="hidden h-7 sm:block" />
        <div class="flex items-center gap-1">
          <UTooltip :text="t('pixelStitch.canvas.zoomOut')">
            <UButton icon="lucide:minus" size="sm" color="neutral" variant="outline" :aria-label="t('pixelStitch.canvas.zoomOut')" :disabled="editor.zoom.value <= 0.25" @click="editor.zoom.value = Math.max(0.25, editor.zoom.value - 0.25)" />
          </UTooltip>
          <UTooltip :text="t('pixelStitch.canvas.zoomReset')">
            <UButton :label="`${Math.round(editor.zoom.value * 100)}%`" size="sm" color="neutral" variant="ghost" :aria-label="t('pixelStitch.canvas.zoomReset')" @click="editor.zoom.value = 1" />
          </UTooltip>
          <UTooltip :text="t('pixelStitch.canvas.zoomIn')">
            <UButton icon="lucide:plus" size="sm" color="neutral" variant="outline" :aria-label="t('pixelStitch.canvas.zoomIn')" :disabled="editor.zoom.value >= 4" @click="editor.zoom.value = Math.min(4, editor.zoom.value + 0.25)" />
          </UTooltip>
        </div>
        <USeparator orientation="vertical" class="hidden h-7 sm:block" />
        <div class="flex items-center gap-1">
          <UTooltip :text="t('pixelStitch.toolbar.undo')"><UButton icon="lucide:undo" size="sm" color="neutral" variant="outline" :disabled="!editor.canUndo.value" :aria-label="t('pixelStitch.toolbar.undo')" @click="editor.undo()" /></UTooltip>
          <UTooltip :text="t('pixelStitch.toolbar.redo')"><UButton icon="lucide:redo" size="sm" color="neutral" variant="outline" :disabled="!editor.canRedo.value" :aria-label="t('pixelStitch.toolbar.redo')" @click="editor.redo()" /></UTooltip>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UDropdownMenu :items="importItems"><UButton :label="t('pixelStitch.toolbar.import')" icon="lucide:upload" color="neutral" variant="outline" size="sm" /></UDropdownMenu>
        <UDropdownMenu :items="saveItems"><UButton :label="t('pixelStitch.saveProject')" icon="lucide:save" color="primary" size="sm" /></UDropdownMenu>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[208px_minmax(0,1fr)_340px] lg:overflow-hidden">
      <aside class="flex min-h-0 flex-col border-b border-default bg-slate-100 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div class="p-3"><PixelStitchToolbar /></div>
        <div class="mt-auto border-t border-default p-3">
          <UTooltip :text="t('pixelStitch.toolbar.toggleGrid')">
            <UButton icon="lucide:grid-3x3" :label="t('pixelStitch.toolbar.toggleGrid')" :color="'neutral'" :variant="editor.gridVisible.value ? 'soft' : 'outline'" block :aria-pressed="editor.gridVisible.value" @click="editor.gridVisible.value = !editor.gridVisible.value" />
          </UTooltip>
        </div>
      </aside>

      <main class="min-w-0 bg-slate-50 p-4 sm:p-6 lg:overflow-auto lg:p-8"><PixelStitchCanvas /></main>

      <aside class="border-b border-default bg-slate-100 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-l">
        <div class="p-4"><PixelStitchColorPicker /></div>
        <USeparator />
        <div class="p-4"><PixelStitchLayerPanel /></div>
        <USeparator />
        <div class="p-4"><PixelStitchOnionSkinControls /></div>
        <USeparator />
        <div class="p-4"><PixelStitchAnimationPreview /></div>
      </aside>
    </div>

    <footer class="fixed inset-x-0 bottom-0 z-10 h-52 border-t border-default bg-slate-100 p-4">
      <PixelStitchFrameStrip />
    </footer>
  </div>

  <PixelStitchSpriteSheetModal
    v-model:open="sheetModalOpen"
    :mode="sheetMode"
    :frame-count="editor.frames.value.length"
    @export="onExportSheet"
    @import="onImportSheet"
  />

  <!-- Encoding blocks the main thread frame by frame, so this is a progress
       report rather than something to cancel — hence no close button. -->
  <UModal
    v-model:open="isExporting"
    :title="t('pixelStitch.exportingGif')"
    :dismissible="false"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <UProgress v-model="exportProgress" :max="100" />
        <p class="text-center text-sm text-muted tabular-nums">{{ Math.round(exportProgress) }}%</p>
      </div>
    </template>
  </UModal>
</template>
