<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { PresetPack } from '~/composables/melodyLoom/types'
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'

const editor = useMelodyLoomContext()
const { t } = useI18n()

const items = computed<SelectItem[]>(() => [
  { label: t('melodyLoom.presets.8bit'), value: '8bit' },
  { label: t('melodyLoom.presets.arcade'), value: 'arcade' },
  { label: t('melodyLoom.presets.chiptune'), value: 'chiptune' },
  { label: t('melodyLoom.presets.retro'), value: 'retro' },
  { label: t('melodyLoom.presets.custom'), value: 'custom' }
])
</script>

<template>
  <USelect
    :model-value="editor.currentPreset.value"
    :items="items"
    :aria-label="t('melodyLoom.presets.label')"
    class="w-44"
    @update:model-value="value => editor.applyPreset(value as PresetPack)"
  />
</template>
