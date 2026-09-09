<script setup lang="ts">
import type { DropdownMenuItem, TabsItem } from '@nuxt/ui'
import { usePatchWorkShop } from '~/composables/usePatchWorkShop'
import { providePatchWorkShop } from '~/composables/usePatchWorkShopContext'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_PRESETS } from '~/composables/patchWorkShop/types'
import { exportCompositionToPng } from '~/composables/patchWorkShop/pngExport'
import { downloadBlob } from '~/composables/files'

definePageMeta({ layout: 'tool' })

const { t } = useI18n()
useHead({ title: () => t('patchworkshop.title') })

const editor = usePatchWorkShop()
providePatchWorkShop(editor)

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

// ─── Export ─────────────────────────────────────────────────────────────────

const upscale = ref(1)
const upscaleItems = computed<DropdownMenuItem[]>(() => [1, 2, 4, 8].map(factor => ({
  label: `${factor}×`,
  type: 'checkbox' as const,
  checked: upscale.value === factor,
  onSelect: () => (upscale.value = factor)
})))

const exporting = ref(false)

async function exportPng() {
  if (editor.layers.value.length === 0 || exporting.value) return
  exporting.value = true
  try {
    const blob = await exportCompositionToPng(editor.layers.value, upscale.value)
    downloadBlob(blob, 'patchworkshop-composition.png')
  } finally {
    exporting.value = false
  }
}

// ─── Keyboard ───────────────────────────────────────────────────────────────

// Bound to the window so the shortcuts work regardless of where focus happens
// to sit, but any field that owns arrow keys and Ctrl/Cmd+C/V for its own text
// editing (the asset search box, a layer rename) has to opt out first.
function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  // A control that already owns arrow keys for itself — the opacity slider,
  // the reorder grip — calls preventDefault() when it handles one. Once it
  // has, this page-wide layer defers instead of also nudging the layer on
  // top of whatever the focused control just did.
  if (event.defaultPrevented) return

  const meta = event.ctrlKey || event.metaKey
  const selectedId = editor.selectedLayerId.value
  // Shift held turns `key` into 'Z', not 'z' — compare lowercased so
  // Ctrl/Cmd+Shift+Z actually matches the redo branch below.
  const key = event.key.toLowerCase()

  if (meta && key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editor.undo()
  } else if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
    event.preventDefault()
    editor.redo()
  } else if (meta && key === 'c') {
    event.preventDefault()
    editor.copySelected()
  } else if (meta && key === 'v') {
    event.preventDefault()
    editor.paste()
  } else if (selectedId && event.key.startsWith('Arrow')) {
    event.preventDefault()
    const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    editor.nudgeLayer(selectedId, dx, dy)
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

// ─── Mobile panels ──────────────────────────────────────────────────────────

// Below `md` the two desktop asides collapse into one bottom sheet, tabbed
// between the same two panels rather than duplicating them.
const mobilePanelOpen = ref(false)
const mobileTab = ref<'assets' | 'layers'>('assets')

function openMobilePanel(tab: 'assets' | 'layers') {
  mobileTab.value = tab
  mobilePanelOpen.value = true
}

const mobileTabItems = computed<TabsItem[]>(() => [
  { label: t('patchworkshop.library.title'), value: 'assets' },
  { label: t('patchworkshop.layers.title'), value: 'layers' }
])
</script>

<template>
  <div class="flex min-h-0 grow flex-col">
    <div class="flex h-[52px] shrink-0 items-center gap-2.5 overflow-x-auto border-b border-default bg-slate-50 px-4">
      <div class="flex h-[34px] items-center gap-0.5 rounded-md border border-default bg-default px-1">
        <UTooltip :text="t('patchworkshop.toolbar.undo')">
          <UButton
            icon="lucide:undo"
            color="neutral"
            variant="ghost"
            :disabled="!editor.canUndo.value"
            :aria-label="t('patchworkshop.toolbar.undo')"
            class="size-[26px] justify-center rounded"
            @click="editor.undo()"
          />
        </UTooltip>
        <UTooltip :text="t('patchworkshop.toolbar.redo')">
          <UButton
            icon="lucide:redo"
            color="neutral"
            variant="ghost"
            :disabled="!editor.canRedo.value"
            :aria-label="t('patchworkshop.toolbar.redo')"
            class="size-[26px] justify-center rounded"
            @click="editor.redo()"
          />
        </UTooltip>
      </div>

      <div class="flex h-[34px] items-center gap-0.5 rounded-md border border-default bg-default px-1">
        <UTooltip :text="t('patchworkshop.toolbar.zoomOut')">
          <UButton
            icon="lucide:minus"
            color="neutral"
            variant="ghost"
            :aria-label="t('patchworkshop.toolbar.zoomOut')"
            :disabled="editor.zoom.value <= MIN_ZOOM"
            class="size-[26px] justify-center rounded"
            @click="stepZoom(-1)"
          />
        </UTooltip>
        <span class="min-w-[42px] px-1 text-center text-[13px] tabular-nums text-muted">
          {{ Math.round(editor.zoom.value * 100) }}%
        </span>
        <UTooltip :text="t('patchworkshop.toolbar.zoomIn')">
          <UButton
            icon="lucide:plus"
            color="neutral"
            variant="ghost"
            :aria-label="t('patchworkshop.toolbar.zoomIn')"
            :disabled="editor.zoom.value >= MAX_ZOOM"
            class="size-[26px] justify-center rounded"
            @click="stepZoom(1)"
          />
        </UTooltip>
      </div>

      <UTooltip :text="t('patchworkshop.toolbar.pan')">
        <UButton
          icon="lucide:hand"
          color="neutral"
          :variant="editor.panMode.value ? 'soft' : 'outline'"
          :aria-pressed="editor.panMode.value"
          :aria-label="t('patchworkshop.toolbar.pan')"
          class="h-[34px] w-[34px] shrink-0 justify-center rounded-md"
          @click="editor.panMode.value = !editor.panMode.value"
        />
      </UTooltip>

      <div class="grow" />

      <UDropdownMenu :items="upscaleItems" :ui="{ content: 'w-32' }">
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="lucide:chevron-down"
          class="h-[34px] gap-1.5 rounded-md px-2.5 text-[13px] tabular-nums"
          :aria-label="t('patchworkshop.toolbar.upscale')"
        >
          {{ upscale }}×
        </UButton>
      </UDropdownMenu>
      <UButton
        :label="t('patchworkshop.toolbar.exportPng')"
        icon="lucide:image-down"
        color="primary"
        :loading="exporting"
        :disabled="editor.layers.value.length === 0"
        class="h-[34px] shrink-0 gap-1.5 rounded-md px-2.5 text-[13px]"
        @click="exportPng"
      />
    </div>

    <div class="flex min-h-0 grow">
      <aside class="hidden w-[300px] shrink-0 flex-col overflow-hidden border-r border-default bg-slate-50 md:flex">
        <PatchWorkShopAssetLibrary />
      </aside>

      <main class="flex min-w-0 grow flex-col bg-slate-50">
        <PatchWorkShopCanvas />
      </main>

      <aside class="hidden w-[300px] shrink-0 flex-col overflow-hidden border-l border-default bg-slate-50 md:flex">
        <PatchWorkShopLayerPanel />
      </aside>
    </div>

    <!-- Mobile-only: the two desktop asides collapse into this bar, each
         button opening the same panel content in a bottom sheet instead of
         permanently claiming screen width the canvas needs on a small
         viewport. -->
    <div class="flex h-14 shrink-0 items-center gap-2 border-t border-default bg-default px-3 md:hidden">
      <UButton
        :label="t('patchworkshop.library.title')"
        icon="lucide:layout-grid"
        color="neutral"
        variant="outline"
        class="grow justify-center"
        @click="openMobilePanel('assets')"
      />
      <UButton
        :label="t('patchworkshop.layers.title')"
        icon="lucide:layers"
        color="neutral"
        variant="outline"
        class="grow justify-center"
        @click="openMobilePanel('layers')"
      />
    </div>

    <UDrawer v-model:open="mobilePanelOpen" :ui="{ content: 'h-[70dvh] max-h-[70dvh]', container: 'h-full p-0 gap-0 overflow-hidden' }">
      <template #content>
        <div class="flex h-full flex-col overflow-hidden">
          <div class="shrink-0 border-b border-default p-3">
            <UTabs v-model="mobileTab" :items="mobileTabItems" :content="false" class="w-full" />
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <PatchWorkShopAssetLibrary v-if="mobileTab === 'assets'" />
            <PatchWorkShopLayerPanel v-else />
          </div>
        </div>
      </template>
    </UDrawer>
  </div>
</template>
