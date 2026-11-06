<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { usePixelStitch } from '~/composables/usePixelStitch'
import { providePixelStitch } from '~/composables/usePixelStitchContext'
import { usePixelStitchProjectsContext } from '~/composables/usePixelStitchProjects'
import { emptyGrid } from '~/composables/pixelStitch/project'
import { loadImage, readFileAsDataUrl } from '~/composables/files'
import { openProjectFile, projectFileName, saveProjectFile } from '~/composables/pixelStitch/persistence'
import { usePixelStitchHost } from '~/composables/pixelStitch/host'
import { GIF_FILE, IMAGE_FILE, PNG_FILE } from '~/composables/pixelStitch/fileTypes'
import { frameToBlob } from '~/composables/pixelStitch/render'
import { exportAsGif } from '~/composables/pixelStitch/gifExport'
import { exportSpriteSheet, importSpriteSheet } from '~/composables/pixelStitch/spriteSheet'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_PRESETS } from '~/composables/pixelStitch/types'

/**
 * One open project: the canvas toolbar, the side panels and the animation
 * panel, around an editor of its own. The page keeps one of these mounted per
 * tab and only shows the active one, so switching tabs keeps each project's
 * undo history, zoom and tool exactly where they were.
 */
const props = defineProps<{
  projectId: string
  active: boolean
}>()

const { t } = useI18n()
const projects = usePixelStitchProjectsContext()
const host = usePixelStitchHost()
const editor = usePixelStitch({
  projectId: props.projectId,
  onSave: data => projects.touch(props.projectId, data)
})
providePixelStitch(editor)

const projectName = computed(() => projects.byId(props.projectId)?.name ?? '')

// A tab that is not in front stops playing: its frames would otherwise keep
// cycling where nobody can see them.
watch(() => props.active, (active) => {
  if (!active) editor.isPlaying.value = false
})

// ─── Zoom ───────────────────────────────────────────────────────────────────

// Minus and plus walk the presets rather than adding a fixed step, so someone
// without a wheel lands on the same round numbers the menu offers.
function stepZoom(direction: 1 | -1) {
  const current = editor.zoom.value
  const next = direction === 1
    ? ZOOM_PRESETS.find(preset => preset > current + 0.001)
    : [...ZOOM_PRESETS].reverse().find(preset => preset < current - 0.001)
  editor.setZoom(next ?? (direction === 1 ? MAX_ZOOM : MIN_ZOOM))
}

// Only an exact match ticks. Rounding a wheel-stopped value to the nearest
// preset would claim the zoom is somewhere it isn't.
const zoomItems = computed<DropdownMenuItem[]>(() => [
  {
    label: t('pixelStitch.canvas.zoomFit'),
    icon: 'lucide:maximize',
    checked: Math.abs(editor.zoom.value - editor.fitZoom.value) < 0.001,
    type: 'checkbox' as const,
    onSelect: () => editor.setZoom(editor.fitZoom.value)
  },
  ...ZOOM_PRESETS.map(preset => ({
    label: `${preset * 100}%`,
    checked: editor.zoom.value === preset,
    type: 'checkbox' as const,
    onSelect: () => editor.setZoom(preset)
  }))
])

// ─── Export / import ────────────────────────────────────────────────────────

async function exportPng() {
  const frame = editor.currentFrame.value
  if (!frame) return
  const blob = await frameToBlob(frame, editor.canvasSize.value)
  if (!blob) return
  const saved = await host.saveFile({
    data: blob,
    suggestedName: `pixel-art-frame-${editor.currentFrameIndex.value + 1}.png`,
    types: [PNG_FILE]
  })
  if (saved) editor.notify('frameExported')
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
    const saved = await host.saveFile({ data: blob, suggestedName: 'pixel-art-animation.gif', types: [GIF_FILE] })
    if (saved) editor.notify('gifExported')
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
  const file = await host.openFile({ types: [IMAGE_FILE] })
  if (!file) return
  try {
    const image = await loadImage(await readFileAsDataUrl(file.data))
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
    const blob = await (await fetch(dataUrl)).blob()
    const saved = await host.saveFile({ data: blob, suggestedName: 'sprite-sheet.png', types: [PNG_FILE] })
    if (saved) editor.notify('spriteSheetExported')
  } catch {
    editor.notify('failedToExportSpriteSheet', 'error')
  }
}

async function onImportSheet(file: Blob, columns: number, rows: number) {
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
    editor.showNotice(t('pixelStitch.toast.importedFrames', { count: imported.length }))
  } catch {
    editor.notify('failedToImportSpriteSheet', 'error')
  }
}

// ─── Project file ───────────────────────────────────────────────────────────

async function saveAsProjectFile() {
  if (await saveProjectFile(editor.toProjectData(), projectName.value)) editor.notify('projectSaved')
}

// A project file opens as a project of its own, in a new tab: loading it over
// the drawing on screen would throw that drawing away.
async function importProjectFile() {
  const file = await openProjectFile()
  if (!file) return
  projects.importProject(file.name, file.data)
}

type FileItem = DropdownMenuItem & { hint?: string }

const importItems = computed<FileItem[]>(() => [
  { label: t('pixelStitch.files.project'), hint: t('pixelStitch.files.projectImportHint'), icon: 'lucide:folder-open', onSelect: importProjectFile },
  { label: t('pixelStitch.files.image'), hint: t('pixelStitch.files.imageHint'), icon: 'lucide:image-plus', onSelect: importImage },
  { label: t('pixelStitch.files.sheet'), hint: t('pixelStitch.files.sheetImportHint'), icon: 'lucide:grid-2x2-check', onSelect: () => openSheetModal('import') }
])

// The project file comes first: that is what someone is looking for when they
// click Save. PNG, GIF and the sheet follow, because they are the same
// gesture — writing a file.
const saveItems = computed<FileItem[]>(() => [
  { label: t('pixelStitch.files.project'), hint: projectFileName(projectName.value), icon: 'lucide:save', onSelect: saveAsProjectFile },
  { label: t('pixelStitch.files.png'), hint: t('pixelStitch.files.pngHint'), icon: 'lucide:image-down', onSelect: exportPng },
  { label: t('pixelStitch.files.gif'), hint: t('pixelStitch.files.gifHint'), icon: 'lucide:file-image', onSelect: exportGif },
  { label: t('pixelStitch.files.sheet'), hint: t('pixelStitch.files.sheetExportHint'), icon: 'lucide:grid-2x2-plus', onSelect: () => openSheetModal('export') }
])

// ─── Keyboard ───────────────────────────────────────────────────────────────

// Bound to the window rather than the canvas: the shortcuts have to work while
// focus sits in a layer-name field or on a toolbar button, which is where it
// usually is between strokes. Every open tab registers one, so each answers
// only while it is the tab in front.
function onKeyDown(event: KeyboardEvent) {
  if (!props.active) return
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
  <div class="flex min-h-0 grow flex-col">
    <!-- What frames the canvas on the left, what reads or writes a file on the
         right. -->
    <div class="relative z-10 flex h-[52px] shrink-0 items-center gap-2.5 border-b border-default bg-slate-50 px-4">
      <PixelStitchCanvasSizeSelector />

      <div class="flex h-[34px] items-center gap-0.5 rounded-md border border-default bg-default px-1">
        <UTooltip :text="t('pixelStitch.canvas.zoomOut')">
          <UButton
            icon="lucide:minus"
            color="neutral"
            variant="ghost"
            :aria-label="t('pixelStitch.canvas.zoomOut')"
            :disabled="editor.zoom.value <= MIN_ZOOM"
            class="size-[26px] justify-center rounded"
            @click="stepZoom(-1)"
          />
        </UTooltip>
        <!-- The middle is a third control, not a label between two: it opens
             the sizes worth going to directly. -->
        <UDropdownMenu :items="zoomItems" :ui="{ content: 'w-[206px]' }">
          <UButton
            color="neutral"
            variant="ghost"
            trailing-icon="lucide:chevron-down"
            class="h-[26px] gap-1 rounded px-1.5 text-[13px] tabular-nums"
            :aria-label="t('pixelStitch.canvas.zoomPresets')"
          >
            {{ Math.round(editor.zoom.value * 100) }}%
          </UButton>
        </UDropdownMenu>
        <UTooltip :text="t('pixelStitch.canvas.zoomIn')">
          <UButton
            icon="lucide:plus"
            color="neutral"
            variant="ghost"
            :aria-label="t('pixelStitch.canvas.zoomIn')"
            :disabled="editor.zoom.value >= MAX_ZOOM"
            class="size-[26px] justify-center rounded"
            @click="stepZoom(1)"
          />
        </UTooltip>
      </div>

      <div class="flex h-[34px] items-center gap-0.5 rounded-md border border-default bg-default px-1">
        <UTooltip :text="t('pixelStitch.toolbar.undo')">
          <UButton
            icon="lucide:undo"
            color="neutral"
            variant="ghost"
            :disabled="!editor.canUndo.value"
            :aria-label="t('pixelStitch.toolbar.undo')"
            class="size-[26px] justify-center rounded"
            @click="editor.undo()"
          />
        </UTooltip>
        <UTooltip :text="t('pixelStitch.toolbar.redo')">
          <UButton
            icon="lucide:redo"
            color="neutral"
            variant="ghost"
            :disabled="!editor.canRedo.value"
            :aria-label="t('pixelStitch.toolbar.redo')"
            class="size-[26px] justify-center rounded"
            @click="editor.redo()"
          />
        </UTooltip>
      </div>

      <div class="grow" />

      <!-- Both menus drop from the bar, anchored to the button that opened
           them. Save is the primary one: writing the file is the gesture
           someone came to this end of the bar for. -->
      <UDropdownMenu :items="importItems" :content="{ align: 'end' }" :ui="{ content: 'w-[280px]' }">
        <UButton
          :label="t('pixelStitch.toolbar.import')"
          icon="lucide:download"
          trailing-icon="lucide:chevron-down"
          color="neutral"
          variant="outline"
          class="h-[34px] gap-1.5 rounded-md px-2.5 text-[13px]"
        />

        <template #item-trailing="{ item }">
          <span class="truncate text-xs text-dimmed">{{ (item as FileItem).hint }}</span>
        </template>
      </UDropdownMenu>
      <UDropdownMenu :items="saveItems" :content="{ align: 'end' }" :ui="{ content: 'w-[300px]' }">
        <UButton
          :label="t('pixelStitch.save')"
          icon="lucide:upload"
          trailing-icon="lucide:chevron-down"
          color="primary"
          class="h-[34px] gap-1.5 rounded-md px-2.5 text-[13px]"
        />

        <template #item-trailing="{ item }">
          <span class="max-w-[150px] truncate text-xs text-dimmed">{{ (item as FileItem).hint }}</span>
        </template>
      </UDropdownMenu>
    </div>

    <div class="flex min-h-0 grow">
      <!-- Both side panels are treated alike: the grey ground, one border
           facing the canvas, and their content sitting straight on the surface
           rather than in nested cards. -->
      <aside class="flex min-h-0 shrink-0 flex-col border-r border-default bg-slate-50">
        <PixelStitchToolbar />
      </aside>

      <!-- The notice line sits under the artboard rather than over it, which
           is why the canvas column is a column. -->
      <main class="flex min-w-0 grow flex-col bg-slate-50">
        <PixelStitchCanvas />
        <PixelStitchNoticeBar />
      </main>

      <!-- The colour section keeps its height and the layers take the rest,
           so only the stack scrolls. -->
      <aside class="flex w-[328px] shrink-0 flex-col overflow-hidden border-l border-default bg-slate-50">
        <div class="shrink-0"><PixelStitchColorPicker /></div>
        <USeparator />
        <PixelStitchLayerPanel />
      </aside>
    </div>

    <footer class="shrink-0 border-t border-default bg-default">
      <PixelStitchAnimationPanel />
    </footer>

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
      :close="false"
      :dismissible="false"
    >
      <template #body>
        <div class="flex flex-col gap-3">
          <UProgress v-model="exportProgress" :max="100" />
          <p class="text-center text-sm text-muted tabular-nums">{{ Math.round(exportProgress) }}%</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
