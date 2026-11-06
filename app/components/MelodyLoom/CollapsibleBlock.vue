<script setup lang="ts">
import { ReorderItem, useDragControls } from 'motion-v'

defineProps<{
  /** Identity the reorder group tracks this block by. */
  value: string
  label: string
  index: number
  count: number
}>()

const emit = defineEmits<{ reorder: [from: number, to: number] }>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const controls = useDragControls()

// motion-v takes plain numbers here, not CSS custom properties, so these are
// the design tokens spelled out: `--duration-fast` (0.15s), the `--ease-out-quart`
// curve from docs/animation.md, and `--shadow-menu` for the dragged block while it
// floats above the stack. A spring would overshoot, which the motion rules rule out.
const DURATION_FAST = 0.15
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const
const SHADOW_MENU = '0 4px 16px rgba(15, 23, 43, 0.12)'

// `defineExpose` doesn't chain, so the grip's own `focusGrip` is re-exposed
// here for the page to call after a keyboard move.
const gripRef = ref<{ focusGrip: () => void } | null>(null)
defineExpose({ focusGrip: () => gripRef.value?.focusGrip() })
</script>

<template>
  <ReorderItem
    :value="value"
    :drag-listener="false"
    :drag-controls="controls"
    :drag-elastic="0.06"
    :drag-momentum="false"
    :while-drag="{ scale: 1.005, zIndex: 30, boxShadow: SHADOW_MENU }"
    :transition="{ type: 'tween', ease: EASE_OUT_QUART, duration: DURATION_FAST }"
    class="relative list-none rounded-lg border border-default bg-default"
  >
    <!-- The grip overlays the header's left padding instead of sitting inside
         it: the collapse trigger is itself a button, and a button can't nest
         another one. -->
    <ReorderGrip
      ref="gripRef"
      :tooltip="t('melodyLoom.blocks.reorder')"
      :label="t('melodyLoom.blocks.reorderLabel', { name: label, position: index + 1, count })"
      :index="index"
      :count="count"
      class="absolute left-1.5 top-1.5 z-10 h-9 w-7"
      @reorder="(from, to) => emit('reorder', from, to)"
      @pointerdown="controls.start($event)"
    />

    <UCollapsible v-model:open="open">
      <!-- Raw button, not UButton: UCollapsible clones its aria-expanded/
           aria-controls straight onto whatever this slot renders, and a
           UButton's own root wrapper doesn't line up with the full-width,
           icon-plus-label row this header needs. -->
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 pl-10 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="open ? 'rounded-t-lg' : 'rounded-lg'"
      >
        <Icon
          :name="open ? 'lucide:chevron-down' : 'lucide:chevron-right'"
          class="size-4 shrink-0 text-dimmed"
        />
        <span class="min-w-0 grow truncate text-sm font-semibold text-highlighted">{{ label }}</span>
      </button>

      <template #content>
        <!-- Reka only unmounts the panel once the closing animation reports
             back, and that never arrives in a window the browser isn't
             painting — which leaves a collapsed block's controls sitting in
             the tab order at zero height. Gating the slot on `open` makes
             collapsed mean gone either way. -->
        <div v-if="open">
          <USeparator />
          <slot />
        </div>
      </template>
    </UCollapsible>
  </ReorderItem>
</template>
