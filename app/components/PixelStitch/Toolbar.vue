<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PixelTool } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const emit = defineEmits<{
  importImage: []
  exportGif: []
  exportSpriteSheet: []
  importSpriteSheet: []
}>()

const TOOLS: { id: PixelTool, icon: string }[] = [
  { id: 'pencil', icon: 'lucide:pencil' },
  { id: 'eraser', icon: 'lucide:eraser' },
  { id: 'fill', icon: 'lucide:paint-bucket' },
  { id: 'replace', icon: 'lucide:paintbrush-vertical' },
  { id: 'select', icon: 'lucide:box-select' }
]

// Only the pencil and eraser paint an area, so the size stepper is theirs.
const sizedTool = computed(() => editor.currentTool.value === 'eraser' || editor.currentTool.value === 'pencil')
const activeSize = computed(() => (editor.currentTool.value === 'eraser' ? editor.eraserSize.value : editor.brushSize.value))

const MIN_BRUSH = 1
const MAX_BRUSH = 8

function resizeBrush(delta: number) {
  const next = Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, activeSize.value + delta))
  if (editor.currentTool.value === 'eraser') editor.eraserSize.value = next
  else editor.brushSize.value = next
}

const clearItems = computed<DropdownMenuItem[]>(() => [
  { label: t('pixelStitch.toolbar.clearCurrentLayer'), icon: 'lucide:layers', onSelect: () => editor.clearLayer() },
  { label: t('pixelStitch.toolbar.clearAllLayers'), icon: 'lucide:trash-2', onSelect: () => editor.clearAllLayers() }
])
</script>

<template>
  <!-- A single-column rail beside the canvas, uncarded: the tools sit next to
       the artwork they act on, and one column keeps every group the same width
       instead of wrapping differently at each window size. -->
  <div class="flex shrink-0 flex-col gap-1.5">
    <UTooltip v-for="tool in TOOLS" :key="tool.id" :text="t(`pixelStitch.tools.${tool.id}Tooltip`)">
      <UButton
        :icon="tool.icon"
        :aria-label="t(`pixelStitch.tools.${tool.id}`)"
        :color="editor.currentTool.value === tool.id ? 'primary' : 'neutral'"
        :variant="editor.currentTool.value === tool.id ? 'solid' : 'outline'"
        @click="editor.currentTool.value = tool.id"
      />
    </UTooltip>

    <USeparator />

    <UTooltip :text="t('pixelStitch.toolbar.removeBackground')">
      <UButton
        icon="lucide:scissors"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.removeBackground')"
        @click="editor.removeBackground()"
      />
    </UTooltip>
    <UTooltip :text="t('pixelStitch.toolbar.flipHorizontal')">
      <UButton
        icon="lucide:flip-horizontal"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.flipHorizontal')"
        @click="editor.flipHorizontal()"
      />
    </UTooltip>
    <UTooltip :text="t('pixelStitch.toolbar.flipVertical')">
      <UButton
        icon="lucide:flip-vertical"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.flipVertical')"
        @click="editor.flipVertical()"
      />
    </UTooltip>

    <!-- Stacked like a spinner: bigger above the reading, smaller below. -->
    <template v-if="sizedTool">
      <USeparator />
      <UTooltip :text="t('pixelStitch.toolbar.increaseSize')">
        <UButton
          icon="lucide:plus"
          size="xs"
          color="neutral"
          variant="outline"
          block
          :disabled="activeSize >= MAX_BRUSH"
          :aria-label="t('pixelStitch.toolbar.increaseSize')"
          @click="resizeBrush(1)"
        />
      </UTooltip>
      <span class="text-center text-xs tabular-nums text-default">{{ activeSize }}×{{ activeSize }}</span>
      <UTooltip :text="t('pixelStitch.toolbar.decreaseSize')">
        <UButton
          icon="lucide:minus"
          size="xs"
          color="neutral"
          variant="outline"
          block
          :disabled="activeSize <= MIN_BRUSH"
          :aria-label="t('pixelStitch.toolbar.decreaseSize')"
          @click="resizeBrush(-1)"
        />
      </UTooltip>
    </template>

    <USeparator />

    <UTooltip :text="t('pixelStitch.toolbar.importImage')">
      <UButton
        icon="lucide:image-plus"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.importImage')"
        @click="emit('importImage')"
      />
    </UTooltip>
    <UTooltip :text="t('pixelStitch.toolbar.exportGif')">
      <UButton
        icon="lucide:file-image"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.exportGif')"
        @click="emit('exportGif')"
      />
    </UTooltip>
    <UTooltip :text="t('pixelStitch.toolbar.exportSpriteSheet')">
      <UButton
        icon="lucide:grid-2x2-plus"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.exportSpriteSheet')"
        @click="emit('exportSpriteSheet')"
      />
    </UTooltip>
    <UTooltip :text="t('pixelStitch.toolbar.importSpriteSheet')">
      <UButton
        icon="lucide:grid-2x2-check"
        color="neutral"
        variant="outline"
        :aria-label="t('pixelStitch.toolbar.importSpriteSheet')"
        @click="emit('importSpriteSheet')"
      />
    </UTooltip>

    <!-- Last in the rail: it's the only control here that destroys work. -->
    <UDropdownMenu :items="clearItems">
      <UTooltip :text="t('pixelStitch.toolbar.clearOptions')">
        <UButton
          icon="lucide:trash-2"
          color="neutral"
          variant="outline"
          :aria-label="t('pixelStitch.toolbar.clearOptions')"
        />
      </UTooltip>
    </UDropdownMenu>
  </div>
</template>
