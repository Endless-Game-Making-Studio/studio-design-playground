<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { PresetPack } from '~/composables/melodyLoom/types'
import { PRESET_PACKS } from '~/composables/melodyLoom/types'
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'

const editor = useMelodyLoomContext()
const { t } = useI18n()

const items = computed<SelectItem[]>(() => [
  ...PRESET_PACKS.map(pack => ({ label: t(`melodyLoom.presets.${pack}`), value: pack })),
  // 'custom' is listed separately because it isn't a pack: it's the label the
  // editor falls back to once the rows stop matching one.
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
