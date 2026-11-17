<script setup lang="ts">
// Hand-rolled rather than <Icon>: @nuxt/icon paints a coloured SVG as one
// static background, and these icons are sprite sheets that play on hover.
const props = defineProps<{ name: string }>()

const SHEETS = import.meta.glob<string>('../../assets/icons/pixel/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
})

const FRAME_SIZE = 16
const FRAME_MS = 200

// Each sheet is its frames side by side, so its width says how many it has.
const sheet = computed(() => {
  const svg = SHEETS[`../../assets/icons/pixel/${props.name}.svg`]!
  const width = Number(svg.match(/viewBox="0 0 (\d+) /)![1])
  const frames = width / FRAME_SIZE
  return {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    style: {
      width: `${frames * 100}%`,
      animationDuration: `${frames * FRAME_MS}ms`,
      animationTimingFunction: `steps(${frames})`
    }
  }
})
</script>

<template>
  <span class="pixel-icon block size-8 shrink-0 overflow-hidden" aria-hidden="true">
    <img :src="sheet.src" :style="sheet.style" alt="" class="pixel-icon-sheet block h-full max-w-none">
  </span>
</template>

<style scoped>
/* Frames step rather than ease: tweening between two pixel drawings would
   smear them. Skipped entirely for reduced motion, leaving the first frame. */
@media (prefers-reduced-motion: no-preference) {
  .pixel-icon:hover .pixel-icon-sheet,
  button:hover .pixel-icon-sheet,
  button:focus-visible .pixel-icon-sheet {
    animation-name: pixel-icon-play;
    animation-iteration-count: infinite;
  }
}

@keyframes pixel-icon-play {
  to {
    transform: translateX(-100%);
  }
}
</style>
