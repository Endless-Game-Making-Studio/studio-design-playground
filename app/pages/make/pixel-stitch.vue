<script setup lang="ts">
import { usePixelStitch } from '~/composables/usePixelStitch'
import { providePixelStitch } from '~/composables/usePixelStitchContext'
import { emptyGrid } from '~/composables/pixelStitch/project'
import { downloadBlob, downloadDataUrl, loadImage, pickFile, readFileAsDataUrl } from '~/composables/pixelStitch/files'
import { downloadProjectFile, openProjectFile } from '~/composables/pixelStitch/persistence'
import { frameToBlob } from '~/composables/pixelStitch/render'
import { exportAsGif } from '~/composables/pixelStitch/gifExport'
import { exportSpriteSheet, importSpriteSheet } from '~/composables/pixelStitch/spriteSheet'

// The tool layout, not the dashboard one: this page opens in its own tab, with
// the tool switcher in the bar instead of the platform's sidebar.
definePageMeta({ layout: 'tool' })

const { t } = useI18n()

// The tool has a browser tab of its own now, so it needs a name in it.
useHead({ title: () => t('pixelStitch.title') })

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
  <div class="flex-1 overflow-x-auto">
    <UContainer class="mt-6 pb-16">
      <!-- No page title: the switcher in the bar already names the tool. What
           the title row carried — the file actions — stays in its place, as a
           thin strip above the workspace. -->
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          :label="t('pixelStitch.openProject')"
          icon="lucide:folder-open"
          color="neutral"
          variant="outline"
          size="sm"
          @click="loadProject"
        />
        <UButton
          :label="t('pixelStitch.saveProject')"
          icon="lucide:save"
          color="neutral"
          variant="outline"
          size="sm"
          @click="saveProjectFile"
        />
        <UTooltip :text="t('pixelStitch.savePngTooltip')">
          <UButton
            :label="t('pixelStitch.savePng')"
            icon="lucide:image-down"
            color="primary"
            size="sm"
            @click="exportPng"
          />
        </UTooltip>
      </div>

      <!-- Fixed columns rather than the original's drag-reorderable panels:
           the tool rail and inspectors stay where the artist left them, and
           the editing surface keeps everything between them. -->
      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="flex min-w-0 items-start gap-4">
          <PixelStitchToolbar
            @import-image="importImage"
            @export-gif="exportGif"
            @export-sprite-sheet="openSheetModal('export')"
            @import-sprite-sheet="openSheetModal('import')"
          />

          <div class="flex min-w-0 flex-1 flex-col gap-4">
            <PixelStitchCanvas />
            <PixelStitchFrameStrip />
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <PixelStitchColorPicker />
          <PixelStitchLayerPanel />
          <PixelStitchOnionSkinControls />
        </div>
      </div>
    </UContainer>
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
