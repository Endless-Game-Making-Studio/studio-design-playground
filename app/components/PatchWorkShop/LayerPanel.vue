<script setup lang="ts">
import { AnimatePresence, ReorderGroup } from 'motion-v'
import type { Layer } from '~/composables/patchWorkShop/types'
import { usePatchWorkShopContext } from '~/composables/usePatchWorkShopContext'

const editor = usePatchWorkShopContext()
const { t } = useI18n()

// The panel lists topmost first; the underlying array stores bottom-to-top
// (last = drawn on top), so this reverses it both ways.
const topFirst = computed({
  get: () => [...editor.layers.value].reverse(),
  set: (next: Layer[]) => editor.setLayerOrderTopFirst(next)
})

const rowRefs = ref<{ focusGrip: () => void }[]>([])
watch(() => topFirst.value.length, count => (rowRefs.value.length = count))

async function onKeyboardReorder(from: number, to: number) {
  if (to < 0 || to >= topFirst.value.length) return
  const next = [...topFirst.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  editor.setLayerOrderTopFirst(next)
  await nextTick()
  rowRefs.value[to]?.focusGrip()
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col gap-2 p-3.5">
    <div class="flex shrink-0 items-center">
      <p class="grow text-[11px] font-semibold uppercase tracking-[0.06em] text-dimmed">
        {{ t('patchworkshop.layers.title') }}
      </p>
      <UTooltip :text="t('patchworkshop.layers.clearAll')">
        <HoldToConfirm
          :label="t('patchworkshop.layers.clearAll')"
          size="sm"
          :disabled="editor.layers.value.length === 0"
          @confirm="editor.clearAll()"
        />
      </UTooltip>
    </div>

    <p v-if="topFirst.length === 0" class="px-1 text-sm text-muted">
      {{ t('patchworkshop.layers.empty') }}
    </p>

    <ReorderGroup
      v-else
      v-model:values="topFirst"
      as="ul"
      axis="y"
      class="-mx-1 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto px-1 py-0.5"
    >
      <AnimatePresence>
        <PatchWorkShopLayerRow
          v-for="(layer, index) in topFirst"
          :ref="element => { if (element) rowRefs[index] = element as unknown as { focusGrip: () => void } }"
          :key="layer.id"
          :layer="layer"
          :index="index"
          :count="topFirst.length"
          @reorder="onKeyboardReorder"
        />
      </AnimatePresence>
    </ReorderGroup>
  </section>
</template>
