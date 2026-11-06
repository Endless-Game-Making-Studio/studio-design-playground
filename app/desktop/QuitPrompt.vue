<script setup lang="ts">
import { shellInvoke } from '~/composables/pixelStitch/desktopHost'
import { saveEverything } from '~/composables/pixelStitch/persistence'

// The page's half of closing the window (`src-tauri/src/close.rs`). The shell
// holds the close and calls the handler below; the page writes what is still
// waiting on autosave, then tells the shell to quit, or asks the person first
// when a write didn't reach the disk. In a plain browser there is no shell,
// so nothing is installed and closing the tab works as it always has.

const { t } = useI18n()
const open = ref(false)

type CloseHandlerWindow = Window & { __pixelStitchCloseRequested?: () => Promise<void> }

const invoke = shellInvoke()

// A second click on the close button while the first is still saving.
let saving = false

async function onCloseRequested() {
  if (saving) return
  saving = true
  // Answer the shell before saving, not after: until it hears back it quits on
  // its own after a few seconds, and a slow disk could still be writing then.
  await invoke!('quit_held')
  let saved = false
  try {
    saved = await saveEverything()
  } catch (error) {
    console.error(`Pixel Stitch: ${String(error)}`)
  } finally {
    saving = false
  }
  if (saved) {
    await invoke!('quit')
    return
  }
  open.value = true
}

function quitAnyway() {
  invoke!('quit')
}

onMounted(() => {
  if (invoke) (window as CloseHandlerWindow).__pixelStitchCloseRequested = onCloseRequested
})

onBeforeUnmount(() => {
  delete (window as CloseHandlerWindow).__pixelStitchCloseRequested
})
</script>

<template>
  <!-- Dismissing it any other way also means "don't quit". -->
  <UModal
    v-model:open="open"
    :title="t('pixelStitch.desktop.quit.title')"
  >
    <template #body>
      <div class="flex flex-col gap-2 text-sm">
        <p>{{ t('pixelStitch.toast.diskSaveFailed') }}</p>
        <p class="text-muted">{{ t('pixelStitch.desktop.quit.body') }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('pixelStitch.desktop.quit.stay')"
          @click="open = false"
        />
        <UButton
          color="error"
          :label="t('pixelStitch.desktop.quit.quit')"
          @click="quitAnyway"
        />
      </div>
    </template>
  </UModal>
</template>
