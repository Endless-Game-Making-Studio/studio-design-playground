<script setup lang="ts">
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const playLabel = computed(() =>
  editor.isPlaying.value ? t('pixelStitch.frames.pause') : t('pixelStitch.frames.play')
)

// Both states share one bar: the same 52px height closed, the same 32px play
// button, the same 16px side padding, and the same hint on the right end. The
// panel only grows a body underneath.
const BAR = 'flex h-[52px] shrink-0 cursor-pointer items-center gap-3 px-4 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
const PLAY = 'size-8 shrink-0 justify-center rounded-md'
const HINT = 'ml-auto flex shrink-0 items-center gap-2 text-xs text-dimmed'

function toggle() {
  editor.animationPanelOpen.value = !editor.animationPanelOpen.value
}
</script>

<template>
  <!-- The panel is its own affordance: clicking the bar opens and closes it, so
       there is no separate toggle control to find. -->
  <section
    v-if="!editor.animationPanelOpen.value"
    :class="BAR"
    role="button"
    tabindex="0"
    :aria-expanded="false"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <UTooltip :text="playLabel">
      <UButton
        :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
        color="neutral"
        variant="outline"
        :aria-label="playLabel"
        :class="PLAY"
        @click.stop="editor.isPlaying.value = !editor.isPlaying.value"
      />
    </UTooltip>
    <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
    <span class="text-xs tabular-nums text-dimmed">
      {{ t('pixelStitch.frames.count', editor.frames.value.length) }}
    </span>
    <span :class="HINT">
      <span>{{ t('pixelStitch.frames.openHint') }}</span>
      <Icon name="lucide:chevron-up" class="size-4" />
    </span>
  </section>

  <!-- No fixed height: the bar keeps the 52px it has closed, so opening does
       not move the control the artist just clicked, and the body below it is as
       tall as a frame tile. Pinning a number here is what left the tile's
       thumbnail and its number row 39px apart. -->
  <section v-else class="flex flex-col">
    <div
      :class="BAR"
      role="button"
      tabindex="0"
      :aria-expanded="true"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <UTooltip :text="playLabel">
        <UButton
          :icon="editor.isPlaying.value ? 'lucide:pause' : 'lucide:play'"
          color="neutral"
          variant="outline"
          :aria-label="playLabel"
          :class="PLAY"
          @click.stop="editor.isPlaying.value = !editor.isPlaying.value"
        />
      </UTooltip>
      <h3 class="font-heading text-sm font-bold text-highlighted">{{ t('pixelStitch.frames.title') }}</h3>
      <span class="text-xs tabular-nums text-dimmed">
        {{ t('pixelStitch.frames.count', editor.frames.value.length) }}
      </span>
      <span :class="HINT">
        <span>{{ t('pixelStitch.frames.closeHint') }}</span>
        <Icon name="lucide:chevron-down" class="size-4" />
      </span>
    </div>

    <USeparator />

    <!-- Three areas, 14px apart. `items-stretch` is what lines their tops and
         bottoms up: the frame tile sets the height and the preview column and
         the controls take the same. -->
    <div class="flex items-stretch gap-3.5 px-4 py-3">
      <div class="flex shrink-0 flex-col gap-1">
        <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
          {{ t('pixelStitch.preview.title') }}
        </p>
        <PixelStitchAnimationPreview class="grow" />
      </div>

      <USeparator orientation="vertical" />

      <div class="min-w-0 grow"><PixelStitchFrameStrip /></div>

      <USeparator orientation="vertical" />

      <div class="flex w-[184px] shrink-0 flex-col justify-center gap-3">
        <div class="flex h-6 items-center gap-2.5">
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

        <div class="flex flex-col gap-1.5">
          <div class="flex h-6 items-center justify-between">
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
              :aria-label="t('pixelStitch.preview.fpsTooltip')"
            />
          </UTooltip>
        </div>
      </div>
    </div>
  </section>
</template>
