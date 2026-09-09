<script setup lang="ts">
import { ReorderGroup } from 'motion-v'
import { installAudioUnlock, getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { useMelodyLoom } from '~/composables/useMelodyLoom'
import { provideMelodyLoom } from '~/composables/useMelodyLoomContext'
import { useWaveformEditor } from '~/composables/useWaveformEditor'
import { provideWaveformEditor } from '~/composables/useWaveformEditorContext'

definePageMeta({ layout: 'tool' })

const { t } = useI18n()
useHead({ title: () => t('melodyLoom.title') })

const editor = useMelodyLoom()
provideMelodyLoom(editor)

const waveform = useWaveformEditor()
provideWaveformEditor(waveform)

// The context is created here, on first gesture, rather than at module scope —
// `getSharedAudioContext` throws during SSR, and iOS/Safari won't make sound
// out of it until a real user gesture unlocks it (see melodyLoom/audioContext.ts).
let disposeUnlock: (() => void) | null = null

onMounted(() => {
  disposeUnlock = installAudioUnlock(getSharedAudioContext())
})

onBeforeUnmount(() => {
  disposeUnlock?.()
  disposeUnlock = null
})

// ─── Blocks ─────────────────────────────────────────────────────────────────

// The control panel above stays put — it drives the sequencer whatever order
// the blocks below end up in. These three are the movable parts.
type BlockId = 'sequencer' | 'waveform' | 'ambience'

const blockOrder = ref<BlockId[]>(['sequencer', 'waveform', 'ambience'])

// The ambience library starts closed: it is a long browse list, while the
// sequencer and the waveform are the two halves someone opened the tool for.
const openBlocks = reactive<Record<BlockId, boolean>>({
  sequencer: true,
  waveform: true,
  ambience: false
})

const blockRefs = ref<{ focusGrip: () => void }[]>([])

// Keyboard reordering moves focus with the block, so a run of arrow presses
// keeps landing on the same grip rather than on whatever slid into its place.
async function onKeyboardReorder(from: number, to: number) {
  if (to < 0 || to >= blockOrder.value.length) return
  const next = [...blockOrder.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  blockOrder.value = next
  await nextTick()
  blockRefs.value[to]?.focusGrip()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <MelodyLoomControlPanel />
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted p-3">
      <ReorderGroup
        v-model:values="blockOrder"
        as="ul"
        axis="y"
        class="flex list-none flex-col gap-3"
      >
        <MelodyLoomCollapsibleBlock
          v-for="(block, index) in blockOrder"
          :ref="element => { if (element) blockRefs[index] = element as unknown as { focusGrip: () => void } }"
          :key="block"
          v-model:open="openBlocks[block]"
          :value="block"
          :label="t(`melodyLoom.blocks.${block}`)"
          :index="index"
          :count="blockOrder.length"
          @reorder="onKeyboardReorder"
        >
          <MelodyLoomSequencerGrid v-if="block === 'sequencer'" />
          <MelodyLoomWaveformEditor v-else-if="block === 'waveform'" />
          <MelodyLoomAmbienceLibrary v-else />
        </MelodyLoomCollapsibleBlock>
      </ReorderGroup>
    </div>
  </div>
</template>
