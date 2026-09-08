<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  disabled?: boolean
  holdDuration?: number
  // The frame tiles are tighter than the layer rows, so the same control comes
  // in the two sizes the design uses rather than being scaled by a wrapper.
  size?: 'sm' | 'md'
}>(), {
  disabled: false,
  holdDuration: 1000,
  size: 'md'
})

const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()

const progress = ref(0)
const holding = ref(false)
const completed = ref(false)

let activeSource: 'pointer' | 'keyboard' | null = null
let animationFrame: number | null = null
let startedAt = 0

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

function reset() {
  stopAnimation()
  activeSource = null
  holding.value = false
  completed.value = false
  progress.value = 0
}

function advance(now: number) {
  progress.value = Math.min((now - startedAt) / props.holdDuration, 1)

  if (progress.value === 1) {
    completed.value = true
    stopAnimation()
    emit('confirm')
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
})
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :aria-describedby="instructionId"
    class="relative inline-grid shrink-0 place-items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' ? 'size-6 rounded-[5px]' : 'size-8 rounded-md',
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
    <!-- The progress follows the button's own shape — a rounded square, like
         every other control in this app, not a ring around one. -->
    <svg
      v-if="holding || completed"
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
    <Icon name="lucide:trash-2" :class="size === 'sm' ? 'size-3.5' : 'size-4'" aria-hidden="true" />
    <span :id="instructionId" class="sr-only">{{ instruction }}</span>
    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </button>
</template>
