<script setup lang="ts">
import { AnimatePresence, Motion } from 'motion-v'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

/**
 * The editor's notice line, along the foot of the canvas area. Everything the
 * editor used to toast lands here instead: one discreet line, right-aligned,
 * that replaces itself. The artist caused these events, so they need
 * acknowledging, not announcing over the drawing.
 */
const editor = usePixelStitchContext()

const INK = {
  success: 'text-muted',
  info: 'text-muted',
  error: 'text-error'
} as const

const ICON = {
  success: 'lucide:check',
  info: 'lucide:info',
  error: 'lucide:triangle-alert'
} as const
</script>

<template>
  <!-- The strip keeps its height whether or not there is anything to say, so
       the artboard above it does not shift each time a notice comes and goes. -->
  <div class="flex h-7 shrink-0 items-center justify-end px-4" aria-live="polite" aria-atomic="true">
    <AnimatePresence>
      <Motion
        v-if="editor.notice.value"
        :key="editor.notice.value.id"
        :initial="{ opacity: 0, y: 4 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -4 }"
        :transition="{ duration: 0.18 }"
        class="flex items-center gap-1.5 text-xs"
        :class="INK[editor.notice.value.color]"
      >
        <Icon :name="ICON[editor.notice.value.color]" class="size-3.5" />
        <span>{{ editor.notice.value.text }}</span>
      </Motion>
    </AnimatePresence>
  </div>
</template>
