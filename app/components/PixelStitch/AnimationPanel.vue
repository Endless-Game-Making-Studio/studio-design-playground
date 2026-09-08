<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const playLabel = computed(() =>
  editor.isPlaying.value ? t('pixelStitch.frames.pause') : t('pixelStitch.frames.play')
)
</script>

<template>
  <!-- Closed, the panel is its own affordance: clicking anywhere on the bar
       opens it, so there is no separate toggle control to find. -->
  <section
    v-if="!editor.animationPanelOpen.value"
    class="flex h-[52px] cursor-pointer items-center gap-3.5 px-4"
    role="button"
    tabindex="0"
    :aria-expanded="false"
    @click="editor.animationPanelOpen.value = true"
    @keydown.enter.prevent="editor.animationPanelOpen.value = true"
    @keydown.space.prevent="editor.animationPanelOpen.value = true"
  >
    <UTooltip :text="playLabel">
      <UButton
        :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
        color="neutral"
        variant="outline"
        :aria-label="playLabel"
        class="size-8 shrink-0 justify-center rounded-md"
        @click.stop="editor.isPlaying.value = !editor.isPlaying.value"
      />
    </UTooltip>
    <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
    <span class="text-xs tabular-nums text-dimmed">
      {{ t('pixelStitch.frames.count', editor.frames.value.length) }}
    </span>
    <div class="flex grow items-center justify-center gap-2">
      <Icon name="lucide:chevron-up" class="size-4 text-dimmed" />
      <span class="text-xs text-dimmed">{{ t('pixelStitch.frames.openHint') }}</span>
    </div>
  </section>

  <section v-else class="flex h-[180px] flex-col gap-2.5 px-4 pb-3.5 pt-2.5">
    <div
      class="flex cursor-pointer items-center gap-3.5"
      role="button"
      tabindex="0"
      :aria-expanded="true"
      @click="editor.animationPanelOpen.value = false"
      @keydown.enter.prevent="editor.animationPanelOpen.value = false"
      @keydown.space.prevent="editor.animationPanelOpen.value = false"
    >
      <UTooltip :text="playLabel">
        <UButton
          :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
          color="neutral"
          variant="outline"
          :aria-label="playLabel"
          class="size-8 shrink-0 justify-center rounded-md"
          @click.stop="editor.isPlaying.value = !editor.isPlaying.value"
        />
      </UTooltip>
      <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
      <div class="flex grow items-center justify-center gap-2">
        <Icon name="lucide:chevron-down" class="size-4 text-dimmed" />
        <span class="text-xs text-dimmed">{{ t('pixelStitch.frames.closeHint') }}</span>
      </div>
    </div>

    <div class="flex min-h-0 grow gap-3.5">
      <div class="flex flex-col gap-1">
        <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
          {{ t('pixelStitch.preview.title') }}
        </p>
        <PixelStitchAnimationPreview />
      </div>

      <USeparator orientation="vertical" />

      <div class="min-w-0 grow"><PixelStitchFrameStrip /></div>

      <USeparator orientation="vertical" />

      <div class="flex w-[184px] shrink-0 flex-col justify-center gap-3">
        <div class="flex items-center gap-2.5">
          <span class="grow text-sm text-muted">{{ t('pixelStitch.onion.title') }}</span>
          <UTooltip :text="t('pixelStitch.onion.tooltip')">
            <USwitch v-model="editor.onionSkin.value" :aria-label="t('pixelStitch.onion.title')" />
          </UTooltip>
        </div>

        <!-- The key is what lets the strip explain itself: the same two colours
             border the neighbouring tiles and tint the ghosts on the canvas. -->
        <div v-if="editor.onionSkin.value" class="flex gap-3">
          <span class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-[3px] bg-cornflower-500" />
            <span class="text-xs text-dimmed">{{ t('pixelStitch.onion.legendPrevious') }}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-[3px] bg-teal-500" />
            <span class="text-xs text-dimmed">{{ t('pixelStitch.onion.legendNext') }}</span>
          </span>
        </div>

        <div>
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-muted">{{ t('pixelStitch.preview.fps') }}</span>
            <span class="text-xs font-semibold tabular-nums text-highlighted">{{ editor.fps.value }}</span>
          </div>
          <!-- A drag rather than a field, so the speed can be moved while the
               animation runs: the playback timer watches `fps`, so a change
               mid-run retimes it instead of waiting for the next play. -->
          <UTooltip :text="t('pixelStitch.preview.fpsTooltip')">
            <USlider
              v-model="editor.fps.value"
              :min="1"
              :max="30"
              :step="1"
              size="xs"
              class="mt-1.5"
              :aria-label="t('pixelStitch.preview.fpsTooltip')"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </section>
</template>
