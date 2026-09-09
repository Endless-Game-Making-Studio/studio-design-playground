<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  disabled?: boolean
  holdDuration?: number
  // The frame tiles are tighter than the layer rows, so the same control comes
  // in the two sizes the design uses rather than being scaled by a wrapper.
  size?: 'sm' | 'md'
  // Every existing use of this control sits in a tight row where the icon
  // already reads as "delete" — but a standalone toolbar action (PatchWorkShop's
  // "Clear All") has nothing else around it to carry that meaning, so it needs
  // its own visible text instead of relying on the tooltip/aria-label.
  showLabel?: boolean
}>(), {
  disabled: false,
  holdDuration: 1000,
  size: 'md',
  showLabel: false
})

const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()

const progress = ref(0)
const holding = ref(false)
const completed = ref(false)

let activeSource: 'pointer' | 'keyboard' | null = null
let animationFrame: number | null = null
let startedAt = 0
let settleTimer: ReturnType<typeof setTimeout> | null = null

// How long the closed outline stays on screen before the action runs. Long
// enough to read as finished, short enough not to feel like lag.
const COMPLETED_HOLD = 160

const instructionId = useId()
const instruction = computed(() => t('pixelStitch.holdToConfirm.instruction', { action: props.label }))
// Deliberately not a percentage: this is a live region, and a number that
// changes every animation frame would be read out continuously. Two states —
// the hold started, the hold landed — is all a screen reader needs.
const status = computed(() => {
  if (completed.value) return t('pixelStitch.holdToConfirm.completed')
  if (holding.value) return t('pixelStitch.holdToConfirm.holding')
  return ''
})
const progressOffset = computed(() => 100 - progress.value * 100)

function stopAnimation() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function stopSettling() {
  if (settleTimer !== null) clearTimeout(settleTimer)
  settleTimer = null
}

function reset() {
  // Releasing after the hold landed must not wipe the finished outline before
  // its beat is up — the action is already on its way.
  if (completed.value) return
  stopAnimation()
  activeSource = null
  holding.value = false
  progress.value = 0
}

function advance(now: number) {
  progress.value = Math.min((now - startedAt) / props.holdDuration, 1)

  if (progress.value === 1) {
    completed.value = true
    stopAnimation()

    // The outline closing is the whole point of the hold, and emitting in the
    // same frame it closed meant the row went before the browser had painted
    // it: the artist saw the progress stop short. Hold the finished state for
    // a beat, then fire.
    settleTimer = setTimeout(() => {
      settleTimer = null
      emit('confirm')
    }, COMPLETED_HOLD)
    return
  }

  animationFrame = requestAnimationFrame(advance)
}

function begin(source: 'pointer' | 'keyboard') {
  if (props.disabled || activeSource || completed.value) return
  activeSource = source
  holding.value = true
  startedAt = performance.now()
  animationFrame = requestAnimationFrame(advance)
}

function cancel(source?: 'pointer' | 'keyboard') {
  if (source && activeSource !== source) return
  reset()
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  begin('pointer')
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }

  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  begin('keyboard')
}

function onKeyUp(event: KeyboardEvent) {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  cancel('keyboard')
}

function onVisibilityChange() {
  if (document.hidden) cancel()
}

onMounted(() => {
  window.addEventListener('blur', reset)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', reset)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopAnimation()
  stopSettling()
})
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :aria-describedby="instructionId"
    class="relative shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      showLabel
        ? 'inline-flex items-center gap-1.5 overflow-hidden rounded-md px-2.5 text-sm font-medium'
        : ['inline-grid place-items-center', size === 'sm' ? 'size-6 rounded-[5px]' : 'size-8 rounded-md'],
      showLabel ? 'h-8' : '',
      // The tint only appears once the hold is under way: idle, this is a plain
      // ghost bin like every other row button.
      holding || completed ? 'bg-error/8 text-error' : 'text-muted hover:text-default'
    ]"
    @click.stop.prevent
    @pointerdown="onPointerDown"
    @pointerup="cancel('pointer')"
    @pointercancel="cancel('pointer')"
    @pointerleave="cancel('pointer')"
    @blur="cancel()"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
  >
    <!-- Icon-only: the progress follows the button's own shape — a rounded
         square, like every other control in this app, not a ring around one. -->
    <svg
      v-if="!showLabel && (holding || completed)"
      class="pointer-events-none absolute inset-0 size-full -rotate-90"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        :rx="size === 'sm' ? 4 : 5"
        pathLength="100"
        fill="none"
        class="stroke-error transition-[stroke-dashoffset] duration-75"
        stroke-width="2"
        stroke-dasharray="100"
        :stroke-dashoffset="progressOffset"
      />
    </svg>
    <!-- Labeled: a square ring reads oddly on a wide pill, so progress fills
         the button's own background left-to-right instead. -->
    <span
      v-if="showLabel && (holding || completed)"
      class="pointer-events-none absolute inset-y-0 left-0 bg-error/15 transition-[width] duration-75"
      :style="{ width: `${progress * 100}%` }"
      aria-hidden="true"
    />
    <Icon name="lucide:trash-2" class="relative" :class="size === 'sm' ? 'size-3.5' : 'size-4'" aria-hidden="true" />
    <span v-if="showLabel" class="relative">{{ label }}</span>
    <span :id="instructionId" class="sr-only">{{ instruction }}</span>
    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </button>
</template>
