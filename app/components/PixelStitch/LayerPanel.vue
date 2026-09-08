<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const layers = computed(() => editor.currentFrame.value?.layers ?? [])

// ─── Drag to reorder ────────────────────────────────────────────────────────

// Pointer-driven rather than HTML5 drag-and-drop, which hands over a drag image
// instead of letting the row itself be the thing in hand.
//
// The list keeps its row count for the whole gesture: the layer being dragged
// renders as an empty slot that travels to wherever it would land, and the row
// itself floats over that slot under the pointer. Showing the slot, a separate
// landing mark and the row all in the flow made one card read as three stacked
// ones, and pushed the list a slot taller while it was held.
const rowRefs = ref<HTMLElement[]>([])
const gripRefs = ref<HTMLElement[]>([])
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

// A `:ref` callback is never told about the element it used to hold, so a
// deleted layer would leave its row behind and the midpoint scan would keep
// measuring a rectangle that is no longer on screen.
watch(() => layers.value.length, (count) => {
  rowRefs.value.length = count
  gripRefs.value.length = count
})

// The order the list renders in while a row is held: the dragged layer sits at
// the position it would drop into, so the travelling slot *is* the preview.
const orderedLayers = computed(() => {
  const source = layers.value
  if (dragIndex.value === null || dropIndex.value === null) return source
  const next = [...source]
  const [moved] = next.splice(dragIndex.value, 1)
  next.splice(dropIndex.value, 0, moved!)
  return next
})

const draggedLayer = computed(() => (dragIndex.value === null ? null : layers.value[dragIndex.value] ?? null))

// The rows render in the held order but every action still addresses a layer by
// its real position in the stack, so the two orders are bridged once here
// rather than with an `indexOf` in each binding.
const realIndex = computed(() => new Map(layers.value.map((layer, index) => [layer.id, index])))

function positionOf(layer: { id: number }) {
  return realIndex.value.get(layer.id) ?? 0
}

// The floating row's geometry: the width of the row it came from, and the
// pointer held at the same spot within it that grabbed it — so the grip stays
// under the cursor instead of the card jumping to be centred on it.
const floating = ref({ x: 0, y: 0, width: 0, offsetX: 0, offsetY: 0 })

const floatingStyle = computed(() => ({
  left: `${floating.value.x - floating.value.offsetX}px`,
  top: `${floating.value.y - floating.value.offsetY}px`,
  width: `${floating.value.width}px`
}))

// Captured once, at the start: the rows do not change count or height during
// the gesture, and re-measuring them each move would feed the travelling slot
// back into the calculation that positions it.
let slotMidpoints: number[] = []

// The listeners go on the window rather than the grip, and pointer capture is
// no use here: the row being held is replaced the moment the drag starts, which
// takes the grip — capture holder and handlers alike — out of the DOM.
function startDrag(index: number, event: PointerEvent) {
  event.preventDefault()

  const row = rowRefs.value[index]
  const rect = row?.getBoundingClientRect()
  slotMidpoints = rowRefs.value.map((element) => {
    const bounds = element?.getBoundingClientRect()
    return bounds ? bounds.top + bounds.height / 2 : Number.POSITIVE_INFINITY
  })

  dragIndex.value = index
  dropIndex.value = index
  floating.value = {
    x: event.clientX,
    y: event.clientY,
    width: rect?.width ?? 0,
    offsetX: rect ? event.clientX - rect.left : 0,
    offsetY: rect ? event.clientY - rect.top : 0
  }

  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', cancelDrag)
  window.addEventListener('blur', cancelDrag)
}

function stopListening() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', cancelDrag)
  window.removeEventListener('blur', cancelDrag)
}

function onDragMove(event: PointerEvent) {
  if (dragIndex.value === null) return
  floating.value = { ...floating.value, x: event.clientX, y: event.clientY }

  let target = slotMidpoints.length - 1
  for (let index = 0; index < slotMidpoints.length; index++) {
    if (event.clientY < slotMidpoints[index]!) {
      target = index
      break
    }
  }
  dropIndex.value = target
}

function endDrag() {
  stopListening()
  if (dragIndex.value !== null && dropIndex.value !== null) {
    editor.reorderLayer(dragIndex.value, dropIndex.value)
  }
  dragIndex.value = null
  dropIndex.value = null
}

// A cancelled gesture puts the row back where it was rather than dropping it
// wherever the pointer happened to die.
function cancelDrag() {
  stopListening()
  dragIndex.value = null
  dropIndex.value = null
}

onBeforeUnmount(stopListening)

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

// The eye's own state while its track is open, so the button reads as the thing
// the popover belongs to.
const openTrackFor = ref<number | null>(null)
</script>

<template>
  <section class="relative flex flex-col gap-2 p-3.5">
    <div class="flex items-center">
      <p class="grow text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
        {{ t('pixelStitch.layers.title') }}
      </p>
      <UTooltip :text="t('pixelStitch.layers.addTooltip')">
        <UButton
          :label="t('pixelStitch.layers.add')"
          icon="lucide:plus"
          color="neutral"
          variant="outline"
          class="h-[30px] gap-1.5 rounded-md px-2.5 text-[13px]"
          @click="editor.addLayer()"
        />
      </UTooltip>
    </div>

    <!-- Listed bottom-up, matching the compositing order: the first entry is
         the layer everything else paints over. -->
    <template v-for="layer in orderedLayers" :key="layer.id">
      <!-- The slot the held row would drop into. It travels with the drag, so
           the list keeps its height and the preview needs no separate mark. -->
      <div
        v-if="draggedLayer && layer.id === draggedLayer.id"
        class="h-11 rounded-[10px] border border-dashed border-slate-200 bg-slate-100"
      />

      <div
        v-else
        :ref="element => { if (element) rowRefs[positionOf(layer)] = element as HTMLElement }"
        class="flex cursor-pointer items-center gap-1.5 rounded-[10px] border p-1.5"
        :class="[
          editor.currentLayerIndex.value === positionOf(layer) ? 'border-primary bg-default' : 'border-transparent',
          layer.opacity === 0 ? 'opacity-45' : ''
        ]"
        @click="editor.currentLayerIndex.value = positionOf(layer)"
      >
        <UTooltip :text="t('pixelStitch.layers.reorder')">
          <button
            :ref="element => { if (element) gripRefs[positionOf(layer)] = element as HTMLElement }"
            type="button"
            class="flex h-8 w-[22px] shrink-0 cursor-grab items-center justify-center rounded-md text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
            :aria-label="t('pixelStitch.layers.reorderLabel', { name: layer.name })"
            @click.stop
            @keydown="onGripKeyDown(positionOf(layer), $event)"
            @pointerdown="startDrag(positionOf(layer), $event)"
          >
            <Icon name="lucide:grip-vertical" class="size-4" />
          </button>
        </UTooltip>

        <UTooltip :text="t('pixelStitch.layers.rename')" class="min-w-0 grow">
          <UInput
            :model-value="layer.name"
            :aria-label="t('pixelStitch.layers.rename')"
            class="w-full"
            :ui="{ base: 'h-8 rounded-md border-transparent bg-transparent ring-0 px-1.5 hover:bg-elevated focus:bg-default focus:ring-1 focus:ring-default' }"
            @click.stop
            @update:model-value="value => editor.renameLayer(positionOf(layer), String(value))"
          />
        </UTooltip>

        <!-- Only below 100%: a list with no numbers is a list where every layer
             is whole. -->
        <span
          v-if="layer.opacity < 1"
          class="min-w-[34px] shrink-0 rounded-[5px] bg-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted"
        >
          {{ Math.round(layer.opacity * 100) }}%
        </span>

        <UPopover
          :open="openTrackFor === positionOf(layer)"
          :content="{ align: 'end', side: 'bottom' }"
          @update:open="value => { openTrackFor = value ? positionOf(layer) : null }"
        >
          <UTooltip :text="t('pixelStitch.layers.opacity')">
            <UButton
              :icon="layer.opacity > 0 ? 'lucide:eye' : 'lucide:eye-off'"
              color="neutral"
              :variant="openTrackFor === positionOf(layer) ? 'outline' : 'ghost'"
              :aria-label="t('pixelStitch.layers.opacityLabel', { name: layer.name })"
              class="size-8 shrink-0 justify-center rounded-md"
              :class="openTrackFor === positionOf(layer) ? 'ring-primary bg-default' : ''"
              @click.stop
            />
          </UTooltip>
          <template #content>
            <!-- The button at the left end is the zero, so hiding and 0% are the
                 same gesture as well as the same state. -->
            <div class="flex w-[262px] items-center gap-2.5 px-3 py-2.5" @click.stop>
              <UButton
                :icon="layer.opacity > 0 ? 'lucide:eye' : 'lucide:eye-off'"
                :color="layer.opacity > 0 ? 'neutral' : 'primary'"
                :variant="layer.opacity > 0 ? 'outline' : 'solid'"
                :aria-label="layer.opacity > 0 ? t('pixelStitch.layers.hide') : t('pixelStitch.layers.show')"
                :aria-pressed="layer.opacity === 0"
                class="size-[30px] shrink-0 justify-center rounded-md"
                @click="editor.toggleLayerHidden(positionOf(layer))"
              />
              <USlider
                :model-value="layer.opacity"
                :min="0"
                :max="1"
                :step="0.05"
                class="grow"
                :aria-label="t('pixelStitch.layers.opacity')"
                @update:model-value="value => editor.setLayerOpacity(positionOf(layer), Number(value))"
              />
              <span class="min-w-[38px] shrink-0 text-right text-xs font-semibold tabular-nums text-highlighted">
                {{ Math.round(layer.opacity * 100) }}%
              </span>
            </div>
          </template>
        </UPopover>

        <UTooltip :text="t('pixelStitch.layers.delete')">
          <HoldToConfirm
            :label="t('pixelStitch.layers.delete')"
            :disabled="layers.length === 1"
            @confirm="editor.deleteLayer(positionOf(layer))"
          />
        </UTooltip>
      </div>
    </template>

    <!-- The row in hand: fixed rather than in the list, so it floats over the
         slot instead of adding a third card to the stack. Tilted just enough to
         read as held, and grabbed where the pointer took it. -->
    <Teleport to="body">
      <div
        v-if="draggedLayer"
        class="pointer-events-none fixed z-50 flex cursor-grabbing items-center gap-1.5 rounded-[10px] border border-primary bg-default p-1.5 shadow-lg"
        :style="{ ...floatingStyle, transform: 'rotate(-0.6deg)' }"
      >
        <span class="flex h-8 w-[22px] shrink-0 items-center justify-center text-dimmed">
          <Icon name="lucide:grip-vertical" class="size-4" />
        </span>
        <span class="min-w-0 grow truncate px-1.5 text-sm font-medium text-highlighted">
          {{ draggedLayer.name }}
        </span>
        <span
          v-if="draggedLayer.opacity < 1"
          class="min-w-[34px] shrink-0 rounded-[5px] bg-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted"
        >
          {{ Math.round(draggedLayer.opacity * 100) }}%
        </span>
      </div>
    </Teleport>
  </section>
</template>
