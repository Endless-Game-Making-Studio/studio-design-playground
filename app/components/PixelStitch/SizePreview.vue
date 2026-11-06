<script setup lang="ts">
/**
 * The same little creature drawn at a board size, so the start screen can show
 * how coarse or fine each size is instead of asking someone to know what
 * "64×64" looks like. Purely illustrative: none of it is project data.
 */
const props = defineProps<{ size: number }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

// Cornflower and its 700 shade: the illustration sits on an orange-selected
// card, and an orange sprite would disappear into it.
const BODY = '#6556f0'
const OUTLINE = '#322b78'
const SHINE = '#a399ff'

// Shapes are tested in [-1, 1] space at each pixel's centre, which is what
// lets one description rasterise cleanly at 16 and at 128.
function colourAt(u: number, v: number, inside: (u: number, v: number) => boolean) {
  for (const eyeX of [-0.3, 0.3]) {
    const distance = Math.hypot(u - eyeX, v - 0.08)
    if (distance < 0.07) return '#020618'
    if (distance < 0.15) return '#FFFFFF'
  }
  if (Math.hypot(u + 0.32, v + 0.2) < 0.12) return SHINE
  return inside(u, v) ? BODY : ''
}

function draw() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const n = props.size
  canvas.width = n
  canvas.height = n
  const centre = (index: number) => ((index + 0.5) / n) * 2 - 1
  const inside = (u: number, v: number) => (u / 0.78) ** 2 + ((v - 0.18) / 0.62) ** 2 <= 1 && v < 0.62
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && inside(centre(x), centre(y))

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!filled(x, y)) continue
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)
      ctx.fillStyle = edge ? OUTLINE : colourAt(centre(x), centre(y), inside)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

onMounted(draw)
watch(() => props.size, draw)
</script>

<template>
  <canvas ref="canvasRef" class="[image-rendering:pixelated]" aria-hidden="true" />
</template>
