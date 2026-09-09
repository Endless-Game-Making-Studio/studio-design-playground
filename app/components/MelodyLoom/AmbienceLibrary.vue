<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import { AMBIENCE_CATEGORIES, findAmbienceCategory } from '~/composables/melodyLoom/ambienceLibrary'
import { previewAmbienceSound, renderAmbienceSound, stopAmbiencePreview } from '~/composables/melodyLoom/ambiencePlayer'
import { useWaveformEditorContext } from '~/composables/useWaveformEditorContext'

const editor = useWaveformEditorContext()
const { t } = useI18n()

const categoryId = ref(AMBIENCE_CATEGORIES[0]!.id)
const soundId = ref<string | null>(null)
const volumePercent = ref(80)
const isAdding = ref(false)
const failed = ref(false)

const category = computed(() => findAmbienceCategory(categoryId.value))
const volume = computed(() => volumePercent.value / 100)

const categoryItems = computed<SelectItem[]>(() =>
  AMBIENCE_CATEGORIES.map(item => ({
    label: item.name,
    value: item.id,
    icon: item.icon
  }))
)

const soundItems = computed<SelectItem[]>(() =>
  (category.value?.sounds ?? []).map(sound => ({
    label: sound.name,
    value: sound.id,
    description: t('melodyLoom.ambience.duration', { seconds: sound.seconds })
  }))
)

// Nothing carries over between categories, so the sound picker starts empty
// again rather than showing a name that isn't in the list under it.
function selectCategory(next: string) {
  categoryId.value = next
  soundId.value = null
}

async function preview(id: string) {
  soundId.value = id
  failed.value = false
  try {
    await previewAmbienceSound(id, volume.value)
  } catch {
    failed.value = true
  }
}

async function addToWaveform() {
  const id = soundId.value
  if (!id || isAdding.value) return

  isAdding.value = true
  failed.value = false
  try {
    // `cursor` is where the user last clicked in the waveform, which is what
    // the editor treats as the playhead while it isn't playing.
    await editor.insertBufferAt(await renderAmbienceSound(id, volume.value), editor.cursor.value)
  } catch {
    failed.value = true
  } finally {
    isAdding.value = false
  }
}

// A four-second clip outlives a click on the tool's back button otherwise —
// the preview plays through the shared context, which the page doesn't tear down.
onBeforeUnmount(stopAmbiencePreview)
</script>

<template>
  <section class="flex flex-col gap-3 p-4">
    <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
      {{ t('melodyLoom.ambience.title') }}
    </p>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField :label="t('melodyLoom.ambience.category')" class="w-44">
        <USelect
          :model-value="categoryId"
          :items="categoryItems"
          :icon="category?.icon"
          class="w-full"
          @update:model-value="value => selectCategory(value as string)"
        />
      </UFormField>

      <UFormField :label="t('melodyLoom.ambience.sound')" class="w-56">
        <USelect
          v-model="soundId"
          :items="soundItems"
          :placeholder="t('melodyLoom.ambience.soundPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('melodyLoom.ambience.volume')"
        :hint="`${volumePercent}%`"
        class="w-40"
      >
        <div class="flex h-8 items-center">
          <USlider v-model="volumePercent" :min="0" :max="100" :step="5" size="sm" />
        </div>
      </UFormField>

      <UButton
        :label="t('melodyLoom.ambience.preview')"
        icon="lucide:play"
        color="neutral"
        variant="outline"
        class="h-9 rounded-md"
        :disabled="!soundId"
        @click="soundId && preview(soundId)"
      />
      <UButton
        :label="t('melodyLoom.ambience.add')"
        icon="lucide:plus"
        color="primary"
        class="h-9 rounded-md"
        :loading="isAdding"
        :disabled="!soundId || editor.isRecording.value"
        @click="addToWaveform"
      />
    </div>

    <UAlert
      v-if="failed"
      color="error"
      variant="subtle"
      icon="lucide:triangle-alert"
      :title="t('melodyLoom.ambience.errors.playbackFailed')"
      close
      @update:open="failed = false"
    />

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <UButton
        v-for="sound in category?.sounds ?? []"
        :key="sound.id"
        icon="lucide:play"
        size="sm"
        :color="soundId === sound.id ? 'primary' : 'neutral'"
        :variant="soundId === sound.id ? 'subtle' : 'outline'"
        class="min-w-0 justify-start rounded-md"
        :aria-pressed="soundId === sound.id"
        @click="preview(sound.id)"
      >
        <span class="truncate">{{ sound.name }}</span>
      </UButton>
    </div>

    <p class="px-1 text-xs text-dimmed">
      {{ t('melodyLoom.ambience.hint') }}
    </p>
  </section>
</template>
