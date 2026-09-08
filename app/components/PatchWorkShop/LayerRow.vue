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

const selected = computed(() => editor.selectedLayerId.value === props.layer.id)
const opacityOpen = ref(false)

function onGripKeyDown(event: KeyboardEvent) {
  const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (direction === 0) return
  event.preventDefault()
  emit('reorder', props.index, props.index + direction)
}

const gripRef = ref<HTMLElement | null>(null)
defineExpose({ focusGrip: () => gripRef.value?.focus() })
</script>

<template>
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
        !layer.visible ? 'opacity-45' : ''
      ]"
      @click="editor.selectLayer(layer.id)"
    >
      <UTooltip :text="t('patchworkshop.layers.reorder')">
        <button
          ref="gripRef"
          type="button"
          class="flex h-8 w-[22px] shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
          :aria-label="t('patchworkshop.layers.reorderLabel', { name: layer.name })"
          @click.stop
          @keydown="onGripKeyDown"
          @pointerdown="controls.start($event)"
        >
          <Icon name="lucide:grip-vertical" class="size-4" />
        </button>
      </UTooltip>

      <img
        :src="layer.imageUrl"
        :alt="layer.name"
        draggable="false"
        class="size-8 shrink-0 rounded-md border border-default object-contain p-0.5"
        style="image-rendering: pixelated"
      >

      <span class="min-w-0 grow truncate text-sm text-highlighted">{{ layer.name }}</span>

      <span
        v-if="layer.opacity < 1"
        class="min-w-[34px] shrink-0 rounded-[5px] bg-slate-200 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-muted"
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
