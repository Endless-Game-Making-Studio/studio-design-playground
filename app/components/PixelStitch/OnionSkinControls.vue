<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-dimmed">{{ t('pixelStitch.onion.title') }}</span>
      <UTooltip :text="t('pixelStitch.onion.tooltip')">
        <USwitch v-model="editor.onionSkin.value" :aria-label="t('pixelStitch.onion.title')" />
      </UTooltip>
    </div>

    <!-- The key is what lets the strip explain itself: the same two colours
         border the neighbouring tiles and tint the ghosts on the canvas. -->
    <div v-if="editor.onionSkin.value" class="flex items-center gap-3 text-xs text-dimmed">
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full bg-cornflower-500" />{{ t('pixelStitch.onion.legendPrevious') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="size-2.5 rounded-full bg-teal-500" />{{ t('pixelStitch.onion.legendNext') }}
      </span>
    </div>
  </section>
</template>
