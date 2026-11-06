<script setup lang="ts">
import type { OpenedFile } from '~/composables/pixelStitch/host'
import { usePixelStitchHost } from '~/composables/pixelStitch/host'
import { IMAGE_FILE } from '~/composables/pixelStitch/fileTypes'

const props = defineProps<{
  mode: 'export' | 'import'
  frameCount: number
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  export: [columns: number]
  import: [file: Blob, columns: number, rows: number]
}>()

const { t } = useI18n()

const columns = ref(4)
const rows = ref(1)
const file = ref<OpenedFile | null>(null)

// Reset per open so a previous run's file doesn't get re-imported by accident,
// and default the row count to whatever squares off the current frames.
watch(open, (isOpen) => {
  if (!isOpen) return
  columns.value = 4
  rows.value = Math.max(1, Math.ceil(props.frameCount / 4))
  file.value = null
})

const exportRows = computed(() => Math.ceil(props.frameCount / Math.max(1, columns.value)))

// The file comes through the host's Open window, like every other import, so a
// desktop build shows its native dialog here too. Cancelling keeps whatever
// was picked before.
async function chooseFile() {
  const picked = await usePixelStitchHost().openFile({ types: [IMAGE_FILE] })
  if (picked) file.value = picked
}

function confirm() {
  if (props.mode === 'export') emit('export', Math.max(1, columns.value))
  else if (file.value) emit('import', file.value.data, Math.max(1, columns.value), Math.max(1, rows.value))
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="mode === 'export' ? t('pixelStitch.sheet.exportTitle') : t('pixelStitch.sheet.importTitle')"
    close
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField v-if="mode === 'import'" :label="t('pixelStitch.sheet.imageFile')">
          <div class="flex min-w-0 items-center gap-3">
            <UButton
              :label="t('pixelStitch.sheet.chooseFile')"
              icon="lucide:image-plus"
              color="neutral"
              variant="outline"
              class="shrink-0"
              @click="chooseFile"
            />
            <span class="truncate text-sm" :class="file ? 'text-default' : 'text-muted'">
              {{ file?.name ?? t('pixelStitch.sheet.noFile') }}
            </span>
          </div>
        </UFormField>

        <UFormField :label="t('pixelStitch.sheet.columns')">
          <UInputNumber v-model="columns" :min="1" class="w-full" />
        </UFormField>

        <UFormField v-if="mode === 'import'" :label="t('pixelStitch.sheet.rows')">
          <UInputNumber v-model="rows" :min="1" class="w-full" />
        </UFormField>

        <p v-if="mode === 'export'" class="text-sm text-muted">
          {{ t('pixelStitch.sheet.summary', { count: frameCount, columns, rows: exportRows }) }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton :label="t('pixelStitch.sheet.cancel')" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          :label="mode === 'export' ? t('pixelStitch.sheet.export') : t('pixelStitch.sheet.import')"
          color="primary"
          :disabled="mode === 'import' && !file"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
