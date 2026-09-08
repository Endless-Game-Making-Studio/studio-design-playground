<script setup lang="ts">
import { ReorderGroup } from 'motion-v'
import type { Layer } from '~/composables/pixelStitch/types'
import { usePixelStitchContext } from '~/composables/usePixelStitchContext'

const editor = usePixelStitchContext()
const { t } = useI18n()

const layers = computed(() => editor.currentFrame.value?.layers ?? [])

// ─── Drag to reorder ────────────────────────────────────────────────────────

// `ReorderGroup` from motion-v, which Nuxt UI already runs on. It reports the
// order it has arrived at, continuously, while the pointer moves: the row being
// held stays under the cursor and its neighbours spring out of the way, so the
// list itself is the preview. That leaves nothing for a placeholder slot or a
// landing mark to say — the hand-rolled version needed both, and the two of
// them plus the row read as three stacked cards.
const order = computed({
  get: () => layers.value,
  set: (next: Layer[]) => editor.setLayerOrder(next)
})

// Focus has to survive an arrow-key move, or a run of presses would strand the
// layer after the first one.
const rowRefs = ref<{ focusGrip: () => void }[]>([])

watch(() => layers.value.length, count => (rowRefs.value.length = count))

async function onKeyboardReorder(from: number, to: number) {
  editor.reorderLayer(from, to)
  await nextTick()
  rowRefs.value[to]?.focusGrip()
}
</script>

<template>
  <section class="flex flex-col gap-2 p-3.5">
    <div class="flex items-center">
      <p class="grow text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
        {{ t('pixelStitch.layers.title') }}
      </p>
      <UTooltip :text="t('pixelStitch.layers.addTooltip')">
        <UButton
          :label="t('pixelStitch.layers.add')"
          icon="lucide:plus"
          color="neutral"
          variant="outline"
          class="h-[30px] gap-1.5 rounded-md px-2.5 text-[13px]"
          @click="editor.addLayer()"
        />
      </UTooltip>
    </div>

    <!-- Listed bottom-up, matching the compositing order: the first entry is
         the layer everything else paints over.

         The list clips what leaves it. `ReorderItem` sets its own
         `dragSnapToOrigin`, which overrides any `dragConstraints` box passed
         in, so a hard pull upward would otherwise carry the row out of the
         panel and leave it floating over the colour picker. The padding is
         there to keep the lifted row's shadow from being cut with it; the
         opacity track is unaffected, being teleported out of this subtree. -->
    <div class="-m-2 overflow-hidden p-2">
      <ReorderGroup
        v-model:values="order"
        as="ul"
        axis="y"
        class="flex list-none flex-col gap-2 p-0"
      >
        <PixelStitchLayerRow
          v-for="(layer, index) in order"
          :ref="element => { if (element) rowRefs[index] = element as unknown as { focusGrip: () => void } }"
          :key="layer.id"
          :layer="layer"
          :index="index"
          :count="order.length"
          @reorder="onKeyboardReorder"
        />
      </ReorderGroup>
    </div>
  </section>
</template>
