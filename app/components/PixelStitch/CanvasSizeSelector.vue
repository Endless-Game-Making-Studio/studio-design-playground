<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { CANVAS_SIZES } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const currentLabel = computed(() => `${editor.canvasSize.value}×${editor.canvasSize.value}`)

// A resize clears every frame — pixel art cannot be carried from one grid to
// another. On an empty canvas that costs nothing, and asking someone to confirm
// the loss of nothing is how they learn to dismiss the question without reading
// it.
const pendingSize = ref<number | null>(null)
const pendingLabel = computed(() => (pendingSize.value === null ? '' : `${pendingSize.value}×${pendingSize.value}`))

function chooseSize(size: number) {
  if (size === editor.canvasSize.value) return
  if (!editor.hasArtwork.value) {
    editor.setCanvasSize(size)
    return
  }
  pendingSize.value = size
}

function confirmResize() {
  const size = pendingSize.value
  pendingSize.value = null
  if (size !== null) editor.setCanvasSize(size)
}

const sizeItems = computed<DropdownMenuItem[]>(() =>
  CANVAS_SIZES.map(size => ({
    label: `${size}×${size}`,
    type: 'checkbox' as const,
    checked: editor.canvasSize.value === size,
    onSelect: () => chooseSize(size)
  }))
)
</script>

<template>
  <UDropdownMenu :items="sizeItems" :ui="{ content: 'w-40' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="lucide:square-plus"
      trailing-icon="lucide:chevron-down"
      class="h-[34px] gap-2 rounded-md px-2.5 text-[13px] tabular-nums"
      :aria-label="t('pixelStitch.canvasSize.label')"
    >
      {{ currentLabel }}
    </UButton>
  </UDropdownMenu>

  <!-- Dismissible, so Escape and a click outside both land on the safe side.
       The buttons name their action rather than answering yes or no. -->
  <UModal
    :open="pendingSize !== null"
    :ui="{ content: 'max-w-[440px]', header: 'hidden' }"
    @update:open="value => { if (!value) pendingSize = null }"
  >
    <template #content>
      <div class="p-5">
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-error/10">
            <Icon name="lucide:triangle-alert" class="size-[18px] text-error" />
          </span>
          <div>
            <h3 class="font-heading text-base font-bold text-highlighted">
              {{ t('pixelStitch.canvasSize.confirmTitle', { size: pendingLabel }) }}
            </h3>
            <p class="mt-1.5 text-sm leading-relaxed text-muted">
              {{ t('pixelStitch.canvasSize.confirmBody', editor.frames.value.length) }}
              {{ t('pixelStitch.canvasSize.confirmReason', { size: currentLabel }) }}
            </p>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            :label="t('pixelStitch.canvasSize.confirmKeep', { size: currentLabel })"
            color="neutral"
            variant="outline"
            class="h-9 rounded-md px-3.5"
            @click="pendingSize = null"
          />
          <UButton
            :label="t('pixelStitch.canvasSize.confirmClear')"
            color="error"
            class="h-9 rounded-md px-3.5"
            @click="confirmResize"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
