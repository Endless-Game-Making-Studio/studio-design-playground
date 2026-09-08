<script setup lang="ts">
import { ReorderItem, useDragControls } from 'motion-v'
import type { Layer } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const props = defineProps<{
  layer: Layer
  index: number
  count: number
}>()

const emit = defineEmits<{ reorder: [from: number, to: number] }>()

const editor = usePixelStitchContext()
const { t } = useI18n()

// One set of controls per row, which is why the row is its own component: the
// drag starts from the grip alone, so `dragListener` is off and the grip's
// pointerdown hands the gesture over. Without that the name field and the four
// buttons on the row would all start a drag.
const controls = useDragControls()

const selected = computed(() => editor.currentLayerIndex.value === props.index)
const hidden = computed(() => props.layer.opacity === 0)

const trackOpen = ref(false)

// ─── Renaming ───────────────────────────────────────────────────────────────

// The name is text until asked for: a permanent field on every row made a
// single click on the name land in an edit box, when a single click on the row
// is how a layer gets selected. Editing starts on a double click, or on Enter
// or F2 from the keyboard — the name carries focus of its own, so renaming
// never needed a pointer.
const editing = ref(false)
const draft = ref('')
const nameInput = ref<{ inputRef?: HTMLInputElement } | null>(null)

async function startEditing() {
  draft.value = props.layer.name
  editing.value = true
  await nextTick()
  const field = nameInput.value?.inputRef
  field?.focus()
  field?.select()
}

function commitName() {
  if (!editing.value) return
  editing.value = false
  const name = draft.value.trim()
  if (name && name !== props.layer.name) editor.renameLayer(props.index, name)
}

// Escape leaves the name as it was, which is the only way back out of a
// mistyped rename.
function cancelName() {
  editing.value = false
}

function onNameKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== 'F2') return
  event.preventDefault()
  startEditing()
}

// Reordering has to work without a pointer too. The parent moves the layer and
// hands focus back to this grip so a run of presses walks it up the list.
const gripRef = ref<HTMLElement | null>(null)

function onGripKeyDown(event: KeyboardEvent) {
  const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (direction === 0) return
  const target = props.index + direction
  if (target < 0 || target >= props.count) return
  event.preventDefault()
  emit('reorder', props.index, target)
}

defineExpose({ focusGrip: () => gripRef.value?.focus() })
</script>

<template>
  <!-- `relative` on the item: the lift's z-index only applies to a positioned
       element, and without it the held row renders under the one below it. -->
  <ReorderItem
    :value="layer"
    :drag-listener="false"
    :drag-controls="controls"
    :drag-elastic="0.06"
    :drag-momentum="false"
    :while-drag="{ scale: 1.02, rotate: -0.6, zIndex: 30, boxShadow: '0 12px 24px rgba(2, 6, 24, 0.18)' }"
    :transition="{ type: 'spring', stiffness: 520, damping: 34 }"
    :exit="{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.16 } }"
    class="relative list-none"
  >
    <div
      class="flex cursor-pointer items-center gap-1.5 rounded-[10px] border p-1.5 transition-colors"
      :class="[
        selected ? 'border-primary bg-default' : 'border-transparent hover:bg-elevated',
        hidden ? 'opacity-45' : ''
      ]"
      @click="editor.currentLayerIndex.value = index"
    >
      <UTooltip :text="t('pixelStitch.layers.reorder')">
        <button
          ref="gripRef"
          type="button"
          class="flex h-8 w-[22px] shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
          :aria-label="t('pixelStitch.layers.reorderLabel', { name: layer.name })"
          @click.stop
          @keydown="onGripKeyDown"
          @pointerdown="controls.start($event)"
        >
          <Icon name="lucide:grip-vertical" class="size-4" />
        </button>
      </UTooltip>

      <UInput
        v-if="editing"
        ref="nameInput"
        v-model="draft"
        :aria-label="t('pixelStitch.layers.rename')"
        class="min-w-0 grow"
        :ui="{ base: 'h-8 rounded-md px-1.5' }"
        @click.stop
        @blur="commitName"
        @keydown.enter.prevent="commitName"
        @keydown.esc.prevent="cancelName"
      />
      <UTooltip v-else :text="t('pixelStitch.layers.renameHint')" class="min-w-0 grow">
        <span
          role="button"
          tabindex="0"
          class="block cursor-pointer truncate rounded-md px-1.5 py-1.5 text-sm text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :aria-label="t('pixelStitch.layers.renameLabel', { name: layer.name })"
          @dblclick.stop="startEditing"
          @keydown="onNameKeyDown"
        >
          {{ layer.name }}
        </span>
      </UTooltip>

      <!-- Only below 100%: a list with no numbers is a list where every layer
           is whole. -->
      <span
        v-if="layer.opacity < 1"
        class="min-w-[34px] shrink-0 rounded-[5px] bg-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted"
      >
        {{ Math.round(layer.opacity * 100) }}%
      </span>

      <UPopover v-model:open="trackOpen" :content="{ align: 'end', side: 'bottom' }">
        <UTooltip :text="t('pixelStitch.layers.opacity')">
          <UButton
            :icon="layer.opacity > 0 ? 'lucide:eye' : 'lucide:eye-off'"
            color="neutral"
            :variant="trackOpen ? 'outline' : 'ghost'"
            :aria-label="t('pixelStitch.layers.opacityLabel', { name: layer.name })"
            class="size-8 shrink-0 justify-center rounded-md"
            :class="trackOpen ? 'ring-primary bg-default' : ''"
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
          :disabled="count === 1"
          @confirm="editor.deleteLayer(index)"
        />
      </UTooltip>
    </div>
  </ReorderItem>
</template>
