<script setup lang="ts">
import type { RadioGroupItem, SelectItem } from '@nuxt/ui'
import { usePixelStitchProjectsContext } from '~/composables/usePixelStitchProjects'
import { saveLocale, type PixelStitchLocale } from '~/composables/pixelStitch/locale'
import { CANVAS_SIZES, DEFAULT_CANVAS_SIZE, PROJECT_NAME_MAX } from '~/composables/pixelStitch/types'

/**
 * What Pixel Stitch shows when no project tab is in front: a form to start a
 * new project, and every saved project below it, so a closed tab is always one
 * click from coming back.
 */
const projects = usePixelStitchProjectsContext()
const { t, locale, locales, setLocale } = useI18n()

// Pre-filled so a project can be made without stopping to think of a name, and
// refreshed each time the screen comes back so the suggestion is never taken.
const name = ref(projects.suggestName())
const size = ref<number>(DEFAULT_CANVAS_SIZE)
const nameValid = computed(() => name.value.trim().length > 0)

const nameInput = ref<{ inputRef?: HTMLInputElement } | null>(null)

onMounted(() => {
  nameInput.value?.inputRef?.focus()
  nameInput.value?.inputRef?.select()
})

const sizeItems = computed<RadioGroupItem[]>(() =>
  CANVAS_SIZES.map(value => ({
    value,
    label: `${value}×${value}`,
    description: t(`pixelStitch.projects.sizeHint.${value}`)
  }))
)

function create() {
  if (!nameValid.value) return
  projects.create(name.value, size.value)
}

// ─── List ───────────────────────────────────────────────────────────────────

const relative = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))

function editedAgo(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60000)
  const format = relative.value
  if (minutes < 1) return t('pixelStitch.projects.editedJustNow')
  if (minutes < 60) return t('pixelStitch.projects.edited', { when: format.format(-minutes, 'minute') })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('pixelStitch.projects.edited', { when: format.format(-hours, 'hour') })
  return t('pixelStitch.projects.edited', { when: format.format(-Math.round(hours / 24), 'day') })
}

const isOpen = (id: string) => projects.openIds.value.includes(id)

// ─── Desktop only: language and version ─────────────────────────────────────

// The web keeps its language control in the account menu, and its version is
// the platform's, so neither belongs on its start screen.
const { isDesktop, appVersion } = useRuntimeConfig().public

const languageItems = computed<SelectItem[]>(() =>
  locales.value.map(l => ({ label: l.name ?? l.code, value: l.code }))
)

const language = computed({
  get: () => locale.value,
  set: (value: PixelStitchLocale) => {
    saveLocale(value)
    setLocale(value)
  }
})
</script>

<template>
  <div class="min-h-0 grow overflow-y-auto bg-muted px-4 py-10 sm:px-6">
    <div class="mx-auto flex max-w-[760px] flex-col gap-7">
      <!-- UPageCard, the platform's card primitive (DESIGN.md), already
           rounded-3xl from app.config. -->
      <UPageCard
        :ui="{ container: 'p-5 sm:p-8' }"
        aria-labelledby="pixel-stitch-new-project"
      >
        <template #body>
          <h1 id="pixel-stitch-new-project" class="font-heading text-2xl font-bold text-highlighted">
            {{ t('pixelStitch.projects.newTitle') }}
          </h1>
          <p class="mt-1.5 text-muted">{{ t('pixelStitch.projects.newSubtitle') }}</p>

          <form class="mt-6 flex flex-col gap-6" @submit.prevent="create">
            <UFormField
              :label="t('pixelStitch.projects.nameLabel')"
              :hint="`${name.length}/${PROJECT_NAME_MAX}`"
              :ui="{ label: 'font-semibold text-highlighted', hint: 'tabular-nums' }"
            >
              <UInput
                ref="nameInput"
                v-model="name"
                :maxlength="PROJECT_NAME_MAX"
                size="xl"
                class="w-full"
                autocomplete="off"
                data-testid="project-name"
              />
            </UFormField>

            <URadioGroup
              v-model="size"
              :items="sizeItems"
              :legend="t('pixelStitch.projects.sizeLabel')"
              variant="card"
              indicator="hidden"
              orientation="horizontal"
              :ui="{
                legend: 'mb-2 font-semibold text-highlighted',
                fieldset: 'grid grid-cols-2 gap-3 sm:grid-cols-4',
                // The checked border comes from the card variant; the tint is
                // added on top so the choice reads from across the screen.
                item: 'relative cursor-pointer flex-col items-center gap-1.5 rounded-2xl px-2.5 pt-4 pb-3.5 text-center transition-shadow duration-250 ease-out hover:shadow-xl motion-reduce:transition-none has-data-[state=checked]:bg-primary/10',
                wrapper: 'flex flex-col items-center gap-1',
                label: 'font-heading text-base font-bold text-highlighted tabular-nums',
                description: 'text-xs text-muted'
              }"
            >
              <template #label="{ item }">
                <PixelStitchSizePreview :size="Number((item as RadioGroupItem & { value: number }).value)" class="mb-1 size-16 rounded-lg bg-elevated" />
                <span>{{ (item as RadioGroupItem & { label: string }).label }}</span>
                <UBadge
                  v-if="(item as RadioGroupItem & { value: number }).value === DEFAULT_CANVAS_SIZE"
                  :label="t('pixelStitch.projects.sizeDefault')"
                  color="primary"
                  variant="soft"
                  size="sm"
                  class="absolute top-2 right-2 rounded-full"
                />
              </template>
            </URadioGroup>

            <div class="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
              <p class="max-w-[380px] text-xs text-dimmed">{{ t('pixelStitch.projects.sizeLater') }}</p>
              <!-- The one primary action on this screen. Large and bold, which is
                   the stopgap DESIGN.md names for white on the brand orange. -->
              <UButton
                type="submit"
                :label="t('pixelStitch.projects.create')"
                icon="lucide:plus"
                color="primary"
                size="xl"
                :disabled="!nameValid"
                class="justify-center rounded-full px-6 font-heading text-[17px] font-bold"
              />
            </div>
          </form>
        </template>
      </UPageCard>

      <section :aria-label="t('pixelStitch.projects.listTitle')">
        <SectionTitle :title="t('pixelStitch.projects.listTitle')">
          <template #trailing>
            <UBadge :label="String(projects.projects.value.length)" color="neutral" variant="soft" class="rounded-full tabular-nums" />
          </template>
        </SectionTitle>

        <UPageCard :ui="{ container: 'p-1.5 sm:p-1.5' }">
          <template #body>
            <ul v-if="projects.recentProjects.value.length" class="flex flex-col gap-0.5" data-testid="project-list">
              <li
                v-for="project in projects.recentProjects.value"
                :key="project.id"
                class="flex items-center gap-2 rounded-2xl pr-2 transition-colors hover:bg-muted"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  class="min-w-0 grow gap-3.5 rounded-2xl px-3 py-2.5 text-left hover:bg-transparent"
                  :aria-label="t(isOpen(project.id) ? 'pixelStitch.projects.switchTo' : 'pixelStitch.projects.open', { name: project.name })"
                  @click="projects.open(project.id)"
                >
                  <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-elevated font-heading text-xs font-bold tabular-nums text-muted">
                    {{ project.canvasSize }}
                  </span>
                  <span class="min-w-0 grow">
                    <span class="block truncate font-semibold text-highlighted">{{ project.name }}</span>
                    <span class="block text-xs tabular-nums text-dimmed">
                      {{ project.canvasSize }}×{{ project.canvasSize }} · {{ editedAgo(project.updatedAt) }}
                    </span>
                  </span>
                  <UBadge
                    v-if="isOpen(project.id)"
                    :label="t('pixelStitch.projects.openBadge')"
                    color="primary"
                    variant="soft"
                    size="sm"
                    class="shrink-0 rounded-full"
                  />
                </UButton>
                <HoldToConfirm
                  :label="t('pixelStitch.projects.delete', { name: project.name })"
                  @confirm="projects.remove(project.id)"
                />
              </li>
            </ul>
            <UEmpty
              v-else
              icon="lucide:layers"
              :description="t('pixelStitch.projects.empty')"
              variant="naked"
            />
          </template>
        </UPageCard>
      </section>

      <footer v-if="isDesktop" class="flex flex-wrap items-center justify-between gap-4">
        <UFormField
          :label="t('pixelStitch.desktop.language')"
          orientation="horizontal"
          :ui="{ root: 'items-center gap-3', label: 'font-semibold text-highlighted' }"
        >
          <USelect
            v-model="language"
            :items="languageItems"
            icon="lucide:languages"
            class="w-44"
          />
        </UFormField>
        <p class="text-xs text-dimmed tabular-nums">{{ t('pixelStitch.desktop.version', { version: appVersion }) }}</p>
      </footer>
    </div>
  </div>
</template>
