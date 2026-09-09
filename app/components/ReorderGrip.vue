<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text — each tool words its own hint, so it arrives already translated. */
  tooltip: string
  /** Accessible name for the grip, likewise already translated. */
  ariaLabel: string
  index: number
  count: number
}>()

const emit = defineEmits<{ reorder: [from: number, to: number] }>()

// The caller owns the layout: PatchWorkShop's grip is a flex child of the row,
// Melody Loom's is absolutely positioned over its header's left padding. Both
// pass their own classes (and PatchWorkShop a `@click.stop`, since its row is
// clickable) straight through to the button.
defineOptions({ inheritAttrs: false })

function onKeyDown(event: KeyboardEvent) {
  const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (direction === 0) return
  event.preventDefault()
  const to = props.index + direction
  if (to < 0 || to >= props.count) return
  emit('reorder', props.index, to)
}

const gripRef = ref<HTMLElement | null>(null)
defineExpose({ focusGrip: () => gripRef.value?.focus() })
</script>

<template>
  <UTooltip :text="tooltip">
    <button
      ref="gripRef"
      type="button"
      class="flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-dimmed transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing"
      :aria-label="ariaLabel"
      v-bind="$attrs"
      @keydown="onKeyDown"
    >
      <Icon name="lucide:grip-vertical" class="size-4" />
    </button>
  </UTooltip>
</template>
