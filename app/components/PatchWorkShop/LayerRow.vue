<script setup lang="ts">
import { ReorderItem, useDragControls } from 'motion-v'
import type { Layer } from '~/composables/patchWorkShop/types'
import { usePatchWorkShopContext } from '~/composables/usePatchWorkShopContext'

const props = defineProps<{
  layer: Layer
  index: number
  count: number
}>()

const emit = defineEmits<{ reorder: [from: number, to: number] }>()

const editor = usePatchWorkShopContext()
const { t } = useI18n()

const controls = useDragControls()

// motion-v takes plain numbers here, not CSS custom properties, so these are
// the design tokens spelled out: `--duration-fast` (0.15s), the `--ease-out-quart`
// curve from docs/animation.md, and `--shadow-menu` for the dragged row while it
// floats above the list. A spring would overshoot, which the motion rules rule out.
const DURATION_FAST = 0.15
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const
const SHADOW_MENU = '0 4px 16px rgba(15, 23, 43, 0.12)'

const selected = computed(() => editor.selectedLayerId.value === props.layer.id)
const opacityOpen = ref(false)

// `defineExpose` doesn't chain, so the grip's own `focusGrip` is re-exposed
// here for LayerPanel to call after a keyboard move.
const gripRef = ref<{ focusGrip: () => void } | null>(null)
defineExpose({ focusGrip: () => gripRef.value?.focusGrip() })

// The row itself has no tabindex — with the grip, lock, eye and delete
// buttons all inside it, a focusable div around them isn't a legal nesting.
// The name is what a keyboard user tabs to instead, same as Pixel Stitch's
// row does for its own name field.
function onNameKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  editor.selectLayer(props.layer.id)
}
</script>

<template>
  <ReorderItem
    :value="layer"
    :drag-listener="false"
    :drag-controls="controls"
    :drag-elastic="0.06"
    :drag-momentum="false"
    :while-drag="{ scale: 1.02, rotate: -0.6, zIndex: 30, boxShadow: SHADOW_MENU }"
    :transition="{ type: 'tween', ease: EASE_OUT_QUART, duration: DURATION_FAST }"
    :exit="{ opacity: 0, height: 0, marginTop: 0, transition: { ease: EASE_OUT_QUART, duration: DURATION_FAST } }"
    class="relative list-none"
  >
    <div
      class="flex cursor-pointer items-center gap-1.5 rounded-[10px] border p-1.5 transition-colors"
      :class="[
        selected ? 'border-primary bg-default' : 'border-transparent hover:bg-elevated',
        !layer.visible ? 'opacity-45' : ''
      ]"
      @click="editor.selectLayer(layer.id)"
    >
      <ReorderGrip
        ref="gripRef"
        :tooltip="t('patchworkshop.layers.reorder')"
        :label="t('patchworkshop.layers.reorderLabel', { name: layer.name })"
        :index="index"
        :count="count"
        class="h-8 w-[22px]"
        @reorder="(from, to) => emit('reorder', from, to)"
        @click.stop
        @pointerdown="controls.start($event)"
      />

      <img
        :src="layer.imageUrl"
        :alt="layer.name"
        draggable="false"
        class="size-8 shrink-0 rounded-md border border-default object-contain p-0.5"
        style="image-rendering: pixelated"
      >

      <span
        role="button"
        tabindex="0"
        class="min-w-0 grow truncate rounded-md text-sm text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="t('patchworkshop.layers.selectLabel', { name: layer.name })"
        :aria-pressed="selected"
        @keydown="onNameKeyDown"
      >{{ layer.name }}</span>

      <!-- Bordered as well as filled: the row itself goes bg-elevated on
           hover, and a same-color pill would disappear into it otherwise. -->
      <span
        v-if="layer.opacity < 1"
        class="min-w-[34px] shrink-0 rounded-[5px] border border-default bg-elevated px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-muted"
      >
        {{ Math.round(layer.opacity * 100) }}%
      </span>

      <UTooltip :text="layer.locked ? t('patchworkshop.layers.unlock') : t('patchworkshop.layers.lock')">
        <UButton
          :icon="layer.locked ? 'lucide:lock' : 'lucide:lock-open'"
          color="neutral"
          :variant="layer.locked ? 'soft' : 'ghost'"
          :aria-pressed="layer.locked"
          :aria-label="layer.locked ? t('patchworkshop.layers.unlockLabel', { name: layer.name }) : t('patchworkshop.layers.lockLabel', { name: layer.name })"
          class="size-8 shrink-0 justify-center rounded-md"
          @click.stop="editor.toggleLayerLocked(layer.id)"
        />
      </UTooltip>

      <UPopover v-model:open="opacityOpen" :content="{ align: 'end', side: 'bottom' }">
        <UTooltip :text="t('patchworkshop.layers.opacity')">
          <UButton
            :icon="layer.visible ? 'lucide:eye' : 'lucide:eye-off'"
            color="neutral"
            :variant="opacityOpen ? 'outline' : 'ghost'"
            :aria-label="t('patchworkshop.layers.opacityLabel', { name: layer.name })"
            class="size-8 shrink-0 justify-center rounded-md"
            :class="opacityOpen ? 'ring-primary bg-default' : ''"
            @click.stop
          />
        </UTooltip>
        <template #content>
          <div class="flex w-[262px] items-center gap-2.5 px-3 py-2.5" @click.stop>
            <UButton
              :icon="layer.visible ? 'lucide:eye' : 'lucide:eye-off'"
              :color="layer.visible ? 'neutral' : 'primary'"
              :variant="layer.visible ? 'outline' : 'solid'"
              :aria-label="layer.visible ? t('patchworkshop.layers.hide') : t('patchworkshop.layers.show')"
              :aria-pressed="!layer.visible"
              class="size-[30px] shrink-0 justify-center rounded-md"
              @click="editor.toggleLayerVisible(layer.id)"
            />
            <USlider
              :model-value="layer.opacity"
              :min="0"
              :max="1"
              :step="0.05"
              class="grow"
              :aria-label="t('patchworkshop.layers.opacity')"
              @update:model-value="value => editor.setLayerOpacityLive(layer.id, Number(value))"
              @change="editor.endLayerOpacity()"
            />
            <span class="min-w-[38px] shrink-0 text-right text-xs font-semibold tabular-nums text-highlighted">
              {{ Math.round(layer.opacity * 100) }}%
            </span>
          </div>
        </template>
      </UPopover>

      <UTooltip :text="t('patchworkshop.layers.delete')">
        <HoldToConfirm
          :label="t('patchworkshop.layers.delete')"
          @confirm="editor.deleteLayer(layer.id)"
        />
      </UTooltip>
    </div>
  </ReorderItem>
</template>
