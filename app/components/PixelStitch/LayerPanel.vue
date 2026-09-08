<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const layers = computed(() => editor.currentFrame.value?.layers ?? [])

// ─── Drag to reorder ────────────────────────────────────────────────────────

// Pointer-driven rather than HTML5 drag-and-drop: the gesture has to show the
// row in hand, the gap it left and the landing mark at once, and the native API
// hands over a drag image instead.
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

// The listeners go on the window rather than the grip, and pointer capture is
// no use here: the first reactive update of the drag replaces the row being
// held with the dashed gap, which takes the grip — capture holder and handlers
// alike — out of the DOM. Bound to the grip, the gesture froze on frame one and
// never committed the move.
function startDrag(index: number, event: PointerEvent) {
  event.preventDefault()
  dragIndex.value = index
  dropIndex.value = index
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
    <template v-for="(layer, index) in layers" :key="layer.id">
      <!-- Where it would land, and the row in hand sitting on that mark:
           lifted off the list, tilted just enough to read as held. -->
      <template v-if="dragIndex !== null && dropIndex === index">
        <div class="-my-0.5 flex items-center gap-1.5">
          <span class="size-2 rounded-full bg-primary" />
          <span class="h-0.5 grow rounded-sm bg-primary" />
        </div>
        <div
          class="flex cursor-grabbing items-center gap-1.5 rounded-[10px] border border-primary bg-default p-1.5 shadow-lg"
          style="transform: rotate(-0.6deg) translateX(6px)"
        >
          <span class="flex h-8 w-[22px] shrink-0 items-center justify-center text-dimmed">
            <Icon name="lucide:grip-vertical" class="size-4" />
          </span>
          <span class="min-w-0 grow truncate px-1.5 text-sm font-medium text-highlighted">
            {{ layers[dragIndex]?.name }}
          </span>
        </div>
      </template>

      <!-- The gap the row left behind. -->
      <div
        v-if="dragIndex === index"
        :ref="element => { if (element) rowRefs[index] = element as HTMLElement }"
        class="h-11 rounded-[10px] border border-dashed border-slate-200 bg-slate-100"
      />

      <div
        v-else
        :ref="element => { if (element) rowRefs[index] = element as HTMLElement }"
        class="flex cursor-pointer items-center gap-1.5 rounded-[10px] border p-1.5"
        :class="[
          editor.currentLayerIndex.value === index ? 'border-primary bg-default' : 'border-transparent',
          layer.opacity === 0 ? 'opacity-45' : ''
        ]"
        @click="editor.currentLayerIndex.value = index"
      >
        <UTooltip :text="t('pixelStitch.layers.reorder')">
          <button
            :ref="element => { if (element) gripRefs[index] = element as HTMLElement }"
            type="button"
            class="flex h-8 w-[22px] shrink-0 cursor-grab items-center justify-center rounded-md text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
            :aria-label="t('pixelStitch.layers.reorderLabel', { name: layer.name })"
            @click.stop
            @keydown="onGripKeyDown(index, $event)"
            @pointerdown="startDrag(index, $event)"
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
            @update:model-value="value => editor.renameLayer(index, String(value))"
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
          :open="openTrackFor === index"
          :content="{ align: 'end', side: 'bottom' }"
          @update:open="value => { openTrackFor = value ? index : null }"
        >
          <UTooltip :text="t('pixelStitch.layers.opacity')">
            <UButton
              :icon="layer.opacity > 0 ? 'lucide:eye' : 'lucide:eye-off'"
              color="neutral"
              :variant="openTrackFor === index ? 'outline' : 'ghost'"
              :aria-label="t('pixelStitch.layers.opacityLabel', { name: layer.name })"
              class="size-8 shrink-0 justify-center rounded-md"
              :class="openTrackFor === index ? 'ring-primary bg-default' : ''"
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
                @click="editor.toggleLayerHidden(index)"
              />
              <USlider
                :model-value="layer.opacity"
                :min="0"
                :max="1"
                :step="0.05"
                class="grow"
                :aria-label="t('pixelStitch.layers.opacity')"
                @update:model-value="value => editor.setLayerOpacity(index, Number(value))"
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
            @confirm="editor.deleteLayer(index)"
          />
        </UTooltip>
      </div>
    </template>
  </section>
</template>
