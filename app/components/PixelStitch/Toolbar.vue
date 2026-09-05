<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PixelTool } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const TOOLS: { id: PixelTool, icon: string }[] = [
  { id: 'pencil', icon: 'lucide:pencil' },
  { id: 'eraser', icon: 'lucide:eraser' },
  { id: 'fill', icon: 'lucide:paint-bucket' },
  { id: 'replace', icon: 'lucide:paintbrush-vertical' },
  { id: 'select', icon: 'lucide:box-select' }
]

// Only the pencil and eraser paint an area, so the size belongs to those two —
// and to each of them separately, so the eraser remembers hers.
const SIZED_TOOLS = ['pencil', 'eraser'] as const
type SizedTool = typeof SIZED_TOOLS[number]

const MIN_BRUSH = 1
const MAX_BRUSH = 8

function isSized(id: PixelTool): id is SizedTool {
  return id === 'pencil' || id === 'eraser'
}

function sizeOf(id: SizedTool) {
  return id === 'eraser' ? editor.eraserSize.value : editor.brushSize.value
}

function resizeBrush(id: SizedTool, delta: number) {
  const next = Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, sizeOf(id) + delta))
  if (id === 'eraser') editor.eraserSize.value = next
  else editor.brushSize.value = next
}

// The size hides on the tool that uses it: a first click picks the tool, a
// second one opens its size. Selecting a tool must never open the popover, or
// reaching for the eraser mid-stroke would land in a menu.
const openSizeFor = ref<SizedTool | null>(null)

function onToolClick(id: PixelTool) {
  if (isSized(id) && editor.currentTool.value === id) {
    openSizeFor.value = id
    return
  }
  editor.currentTool.value = id
}

const clearItems = computed<DropdownMenuItem[]>(() => [
  { label: t('pixelStitch.toolbar.clearCurrentLayer'), icon: 'lucide:layers', onSelect: () => editor.clearLayer() },
  { label: t('pixelStitch.toolbar.clearAllLayers'), icon: 'lucide:trash-2', onSelect: () => editor.clearAllLayers() }
])
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="grid grid-cols-3 gap-1.5">
      <UPopover
        v-for="tool in TOOLS"
        :key="tool.id"
        :open="openSizeFor === tool.id"
        @update:open="value => { if (!value) openSizeFor = null }"
      >
        <UTooltip :text="t(`pixelStitch.tools.${tool.id}Tooltip`)">
          <UButton
            :icon="tool.icon"
            :aria-label="t(`pixelStitch.tools.${tool.id}`)"
            :color="editor.currentTool.value === tool.id ? 'primary' : 'neutral'"
            :variant="editor.currentTool.value === tool.id ? 'solid' : 'outline'"
            block
            @click="onToolClick(tool.id)"
          />
        </UTooltip>
        <template v-if="isSized(tool.id)" #content>
          <!-- Just the number: a preview square in a 1×1-to-8×8 range says
               less than the cursor already showing on the canvas. -->
          <div class="flex items-center gap-1 p-1">
            <UButton
              icon="lucide:minus"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="sizeOf(tool.id) <= MIN_BRUSH"
              :aria-label="t('pixelStitch.toolbar.decreaseSize')"
              @click="resizeBrush(tool.id, -1)"
            />
            <span class="min-w-10 text-center text-xs tabular-nums text-default">{{ sizeOf(tool.id) }}×{{ sizeOf(tool.id) }}</span>
            <UButton
              icon="lucide:plus"
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="sizeOf(tool.id) >= MAX_BRUSH"
              :aria-label="t('pixelStitch.toolbar.increaseSize')"
              @click="resizeBrush(tool.id, 1)"
            />
          </div>
        </template>
      </UPopover>
    </div>

    <USeparator />

    <div class="grid grid-cols-3 gap-1.5">
      <UTooltip :text="t('pixelStitch.toolbar.removeBackground')">
        <UButton icon="lucide:scissors" color="neutral" variant="outline" :aria-label="t('pixelStitch.toolbar.removeBackground')" @click="editor.removeBackground()" />
      </UTooltip>
      <UTooltip :text="t('pixelStitch.toolbar.flipHorizontal')">
        <UButton icon="lucide:flip-horizontal" color="neutral" variant="outline" :aria-label="t('pixelStitch.toolbar.flipHorizontal')" @click="editor.flipHorizontal()" />
      </UTooltip>
      <UTooltip :text="t('pixelStitch.toolbar.flipVertical')">
        <UButton icon="lucide:flip-vertical" color="neutral" variant="outline" :aria-label="t('pixelStitch.toolbar.flipVertical')" @click="editor.flipVertical()" />
      </UTooltip>
    </div>

    <USeparator />

    <UDropdownMenu :items="clearItems">
      <UButton icon="lucide:trash-2" trailing-icon="lucide:chevron-down" color="neutral" variant="outline" block :label="t('pixelStitch.toolbar.clearOptions')" />
    </UDropdownMenu>
  </section>
</template>
