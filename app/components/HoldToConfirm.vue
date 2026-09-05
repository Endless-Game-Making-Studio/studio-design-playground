<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  disabled?: boolean
  holdDuration?: number
}>(), {
  disabled: false,
  holdDuration: 1000
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
    class="relative inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    @click.stop.prevent
    @pointerdown="onPointerDown"
    @pointerup="cancel('pointer')"
    @pointercancel="cancel('pointer')"
    @pointerleave="cancel('pointer')"
    @blur="cancel()"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
  >
    <svg class="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="8"
        pathLength="100"
        fill="none"
        class="stroke-default"
        stroke-width="2"
      />
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="8"
        pathLength="100"
        fill="none"
        class="stroke-error transition-[stroke-dashoffset] duration-75"
        stroke-width="2"
        stroke-dasharray="100"
        :stroke-dashoffset="progressOffset"
      />
    </svg>
    <Icon name="lucide:trash-2" class="size-4" aria-hidden="true" />
    <span :id="instructionId" class="sr-only">{{ instruction }}</span>
    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </button>
</template>
