<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { PixelTool } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

// Icon-only, one per row, in the order the rail inventory settled on: the five
// drawing tools, the three that transform a layer, clear, and the grid switch
// apart at the bottom.
const TOOLS: { id: PixelTool, icon: string }[] = [
  { id: 'pencil', icon: 'lucide:pencil' },
  { id: 'eraser', icon: 'lucide:eraser' },
  { id: 'fill', icon: 'lucide:paint-bucket' },
  { id: 'replace', icon: 'lucide:paintbrush-vertical' },
  { id: 'select', icon: 'lucide:box-select' }
]

const TRANSFORMS: { key: string, icon: string, run: () => void }[] = [
  { key: 'removeBackground', icon: 'lucide:scissors', run: () => editor.removeBackground() },
  { key: 'flipHorizontal', icon: 'lucide:flip-horizontal', run: () => editor.flipHorizontal() },
  { key: 'flipVertical', icon: 'lucide:flip-vertical', run: () => editor.flipVertical() }
]

const clearItems = computed<DropdownMenuItem[]>(() => [
  { label: t('pixelStitch.toolbar.clearCurrentLayer'), icon: 'lucide:layers', onSelect: () => editor.clearLayer() },
  { label: t('pixelStitch.toolbar.clearAllLayers'), icon: 'lucide:trash-2', onSelect: () => editor.clearAllLayers() }
])

// Only the pencil and eraser paint an area, so the size belongs to those two —
// and to each of them separately, so the eraser remembers hers.
const MIN_BRUSH = 1
const MAX_BRUSH = 8

type SizedTool = 'pencil' | 'eraser'

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

// The actual-size preview is a toggle rather than a hover: it is something to
// leave open while drawing and glance at, not something to reach for.
const previewOpen = ref(false)

const RAIL_BUTTON = 'size-[34px] justify-center rounded-md'
</script>

<template>
  <section class="flex min-h-0 flex-col gap-1.5 overflow-y-auto p-3">
    <UPopover
      v-for="tool in TOOLS"
      :key="tool.id"
      :open="openSizeFor === tool.id"
      :content="{ side: 'right', align: 'start' }"
      @update:open="value => { if (!value) openSizeFor = null }"
    >
      <UTooltip :text="t(`pixelStitch.tools.${tool.id}Tooltip`)" :content="{ side: 'right' }">
        <UButton
          :icon="tool.icon"
          :aria-label="t(`pixelStitch.tools.${tool.id}`)"
          :color="editor.currentTool.value === tool.id ? 'primary' : 'neutral'"
          :variant="editor.currentTool.value === tool.id ? 'solid' : 'outline'"
          :class="RAIL_BUTTON"
          @click="onToolClick(tool.id)"
        />
      </UTooltip>
      <template v-if="isSized(tool.id)" #content>
        <!-- Just the number between the two buttons. What really shows the size
             is the cursor over the canvas, so a swatch here would be the same
             thing said twice. -->
        <div class="flex w-32 items-center gap-1.5 p-2">
          <UButton
            icon="lucide:minus"
            color="neutral"
            variant="outline"
            :disabled="sizeOf(tool.id) <= MIN_BRUSH"
            :aria-label="t('pixelStitch.toolbar.decreaseSize')"
            class="size-7 shrink-0 justify-center rounded-md"
            @click="resizeBrush(tool.id, -1)"
          />
          <span class="grow text-center text-[13px] font-semibold tabular-nums text-highlighted">
            {{ sizeOf(tool.id) }}×{{ sizeOf(tool.id) }}
          </span>
          <UButton
            icon="lucide:plus"
            color="neutral"
            variant="outline"
            :disabled="sizeOf(tool.id) >= MAX_BRUSH"
            :aria-label="t('pixelStitch.toolbar.increaseSize')"
            class="size-7 shrink-0 justify-center rounded-md"
            @click="resizeBrush(tool.id, 1)"
          />
        </div>
      </template>
    </UPopover>

    <USeparator class="my-0.5" />

    <UTooltip
      v-for="action in TRANSFORMS"
      :key="action.key"
      :text="t(`pixelStitch.toolbar.${action.key}`)"
      :content="{ side: 'right' }"
    >
      <UButton
        :icon="action.icon"
        color="neutral"
        variant="outline"
        :aria-label="t(`pixelStitch.toolbar.${action.key}`)"
        :class="RAIL_BUTTON"
        @click="action.run()"
      />
    </UTooltip>

    <USeparator class="my-0.5" />

    <UDropdownMenu :items="clearItems" :content="{ side: 'right', align: 'start' }">
      <UTooltip :text="t('pixelStitch.toolbar.clearOptions')" :content="{ side: 'right' }">
        <UButton
          icon="lucide:trash-2"
          color="neutral"
          variant="outline"
          :aria-label="t('pixelStitch.toolbar.clearOptions')"
          :class="RAIL_BUTTON"
        />
      </UTooltip>
    </UDropdownMenu>

    <!-- The two view switches sit apart at the foot of the rail: they change
         what you see, not what you draw. Their on state is a grey fill rather
         than the orange one — in this rail orange means "this is the tool in
         your hand", and neither of these is a tool. -->
    <div class="mt-auto flex flex-col gap-1.5 pt-1.5">
      <USeparator class="my-0.5" />

      <UTooltip :text="t('pixelStitch.toolbar.toggleGrid')" :content="{ side: 'right' }">
        <UButton
          icon="lucide:grid-3x3"
          color="neutral"
          :variant="editor.gridVisible.value ? 'subtle' : 'outline'"
          :aria-label="t('pixelStitch.toolbar.toggleGrid')"
          :aria-pressed="editor.gridVisible.value"
          :class="[RAIL_BUTTON, editor.gridVisible.value ? 'bg-slate-100 ring-slate-200 text-highlighted' : '']"
          @click="editor.gridVisible.value = !editor.gridVisible.value"
        />
      </UTooltip>

      <UPopover v-model:open="previewOpen" :content="{ side: 'right', align: 'end' }">
        <UTooltip :text="t('pixelStitch.toolbar.actualSize')" :content="{ side: 'right' }">
          <UButton
            icon="lucide:image"
            color="neutral"
            :variant="previewOpen ? 'subtle' : 'outline'"
            :aria-label="t('pixelStitch.toolbar.actualSize')"
            :aria-pressed="previewOpen"
            :class="[RAIL_BUTTON, previewOpen ? 'bg-slate-100 ring-slate-200 text-highlighted' : '']"
          />
        </UTooltip>
        <template #content>
          <PixelStitchActualSizePreview />
        </template>
      </UPopover>
    </div>
  </section>
</template>
