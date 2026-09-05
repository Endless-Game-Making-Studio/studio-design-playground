<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const layers = computed(() => editor.currentFrame.value?.layers ?? [])

// ─── Drag to reorder ────────────────────────────────────────────────────────

// Pointer-driven rather than HTML5 drag-and-drop: the gesture has to show the
// lifted row, the gap it left and the landing mark at once, and the native API
// hands over a drag image instead.
const rowRefs = ref<HTMLElement[]>([])
const gripRefs = ref<HTMLElement[]>([])
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
const liftPosition = ref({ x: 0, y: 0 })

const draggedLayer = computed(() => (dragIndex.value === null ? null : layers.value[dragIndex.value]))

function startDrag(index: number, event: PointerEvent) {
  event.preventDefault()
  dragIndex.value = index
  dropIndex.value = index
  liftPosition.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onDragMove(event: PointerEvent) {
  if (dragIndex.value === null) return
  liftPosition.value = { x: event.clientX, y: event.clientY }

  // The row whose vertical midpoint the pointer has passed is the one being
  // displaced, which is what the landing mark sits above.
  let target = layers.value.length - 1
  for (let index = 0; index < rowRefs.value.length; index++) {
    const rect = rowRefs.value[index]?.getBoundingClientRect()
    if (!rect) continue
    if (event.clientY < rect.top + rect.height / 2) {
      target = index
      break
    }
  }
  dropIndex.value = target
}

function endDrag() {
  if (dragIndex.value !== null && dropIndex.value !== null) {
    editor.reorderLayer(dragIndex.value, dropIndex.value)
  }
  dragIndex.value = null
  dropIndex.value = null
}

// Without the chevrons, reordering needs another way in that isn't a pointer.
// The grip keeps focus across the move so a run of presses walks the layer up
// the list instead of stranding it after the first one.
async function onGripKeyDown(index: number, event: KeyboardEvent) {
  const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (direction === 0) return
  const target = index + direction
  if (target < 0 || target >= layers.value.length) return
  event.preventDefault()
  editor.reorderLayer(index, target)
  await nextTick()
  gripRefs.value[target]?.focus()
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h3 class="font-heading font-bold text-sm text-highlighted">{{ t('pixelStitch.layers.title') }}</h3>
      <UTooltip :text="t('pixelStitch.layers.addTooltip')">
        <UButton
          :label="t('pixelStitch.layers.add')"
          icon="lucide:plus"
          size="xs"
          color="neutral"
          variant="outline"
          @click="editor.addLayer()"
        />
      </UTooltip>
    </div>

    <!-- Listed bottom-up, matching the compositing order: the first entry is
         the layer everything else paints over. -->
    <div class="flex max-h-96 flex-col gap-2 overflow-y-auto">
      <template v-for="(layer, index) in layers" :key="layer.id">
        <!-- The landing mark, drawn in the gap the row would drop into. -->
        <div v-if="dragIndex !== null && dropIndex === index" class="h-0.5 rounded-full bg-primary" />

        <div
          :ref="element => { if (element) rowRefs[index] = element as HTMLElement }"
          :class="[
            editor.currentLayerIndex.value === index ? 'ring-2 ring-primary' : 'ring-1 ring-default',
            dragIndex === index ? 'border-2 border-dashed border-default bg-transparent opacity-40' : 'bg-slate-50'
          ]"
          class="flex cursor-pointer flex-col gap-2 rounded-xl p-2.5"
          @click="editor.currentLayerIndex.value = index"
        >
          <div class="flex items-center gap-1">
            <UTooltip :text="t('pixelStitch.layers.reorder')">
              <button
                :ref="element => { if (element) gripRefs[index] = element as HTMLElement }"
                type="button"
                class="shrink-0 cursor-grab rounded-md p-1 text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
                :aria-label="t('pixelStitch.layers.reorderLabel', { name: layer.name })"
                @click.stop
                @keydown="onGripKeyDown(index, $event)"
                @pointerdown="startDrag(index, $event)"
                @pointermove="onDragMove"
                @pointerup="endDrag"
                @pointercancel="endDrag"
              >
                <Icon name="lucide:grip-vertical" class="size-4" />
              </button>
            </UTooltip>

            <UTooltip :text="t('pixelStitch.layers.rename')" class="min-w-0 flex-1">
              <UInput
                :model-value="layer.name"
                size="xs"
                :aria-label="t('pixelStitch.layers.rename')"
                class="w-full"
                @click.stop
                @update:model-value="value => editor.renameLayer(index, String(value))"
              />
            </UTooltip>

            <UTooltip :text="layer.visible ? t('pixelStitch.layers.hide') : t('pixelStitch.layers.show')">
              <UButton
                :icon="layer.visible ? 'lucide:eye' : 'lucide:eye-off'"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="layer.visible ? t('pixelStitch.layers.hide') : t('pixelStitch.layers.show')"
                @click.stop="editor.toggleLayerVisibility(index)"
              />
            </UTooltip>
            <UTooltip :text="t('pixelStitch.layers.delete')">
              <HoldToConfirm
                :label="t('pixelStitch.layers.delete')"
                :disabled="layers.length === 1"
                @confirm="editor.deleteLayer(index)"
              />
            </UTooltip>
          </div>

          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-dimmed">
              <span>{{ t('pixelStitch.layers.opacity') }}</span>
              <span class="tabular-nums">{{ Math.round(layer.opacity * 100) }}%</span>
            </div>
            <USlider
              :model-value="layer.opacity"
              :min="0"
              :max="1"
              :step="0.1"
              size="xs"
              @click.stop
              @update:model-value="value => editor.setLayerOpacity(index, Number(value))"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- The lifted row. Fixed rather than in the list, so it can follow the
         pointer past the panel's own scroll area. -->
    <Teleport to="body">
      <div
        v-if="draggedLayer"
        class="pointer-events-none fixed z-50 -translate-x-4 -translate-y-1/2 rounded-xl bg-default px-3 py-2 text-sm shadow-lg ring-1 ring-default"
        :style="{ left: `${liftPosition.x}px`, top: `${liftPosition.y}px` }"
      >
        {{ draggedLayer.name }}
      </div>
    </Teleport>
  </section>
</template>
