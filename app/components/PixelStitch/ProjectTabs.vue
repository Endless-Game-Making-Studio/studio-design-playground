<script setup lang="ts">
import { usePixelStitchProjectsContext } from '~/composables/usePixelStitchProjects'
import { PROJECT_NAME_MAX } from '~/composables/pixelStitch/types'

/**
 * The strip of open projects between the platform bar and the canvas toolbar.
 *
 * Built by hand rather than with UTabs: each tab carries its own close button,
 * and UTabs' trigger is itself a button, so the close control would have to
 * nest a button inside a button. Here a tab is a pair of siblings — the tab
 * proper and its close — inside a plain wrapper.
 */
const projects = usePixelStitchProjectsContext()
const { t } = useI18n()

const startShowing = computed(() => projects.activeId.value === null)

// ─── Keyboard ───────────────────────────────────────────────────────────────

// Roving focus, as a tablist expects: only the selected tab sits in the Tab
// order, and the arrow keys move between tabs (and select them as they go).
const tabRefs = new Map<string, HTMLElement>()

function setTabRef(id: string, element: unknown) {
  const el = (element as { $el?: HTMLElement } | null)?.$el ?? element
  if (el instanceof HTMLElement) tabRefs.set(id, el)
  else tabRefs.delete(id)
}

function onTabKeyDown(event: KeyboardEvent, id: string) {
  const ids = projects.openIds.value
  const index = ids.indexOf(id)
  let next: string | undefined
  if (event.key === 'ArrowRight') next = ids[(index + 1) % ids.length]
  else if (event.key === 'ArrowLeft') next = ids[(index - 1 + ids.length) % ids.length]
  else if (event.key === 'Home') next = ids[0]
  else if (event.key === 'End') next = ids.at(-1)
  else if (event.key === 'F2') {
    event.preventDefault()
    startRename(id)
    return
  }
  if (!next) return
  event.preventDefault()
  projects.activate(next)
  nextTick(() => tabRefs.get(next)?.focus())
}

// ─── Rename ─────────────────────────────────────────────────────────────────

const renaming = ref<string | null>(null)
const draft = ref('')
const renameInput = ref<{ inputRef?: HTMLInputElement } | null>(null)

function startRename(id: string) {
  const project = projects.byId(id)
  if (!project) return
  projects.activate(id)
  draft.value = project.name
  renaming.value = id
  nextTick(() => {
    renameInput.value?.inputRef?.focus()
    renameInput.value?.inputRef?.select()
  })
}

// Enter and blur both commit, so the name ends where the artist left it; an
// empty name is not a name, and keeps the old one.
function commitRename() {
  const id = renaming.value
  if (id === null) return
  renaming.value = null
  projects.rename(id, draft.value)
  nextTick(() => tabRefs.get(id)?.focus())
}

function cancelRename() {
  const id = renaming.value
  renaming.value = null
  if (id) nextTick(() => tabRefs.get(id)?.focus())
}
</script>

<template>
  <nav
    class="flex h-11 shrink-0 items-end gap-1 border-b border-default bg-elevated px-3"
    :aria-label="t('pixelStitch.projects.tabsLabel')"
  >
    <!-- Scrolls sideways rather than squashing the tabs, so a name stays
         readable however many are open. The list reaches 1px down over the
         strip's bottom border, so the tab in front can cover that line and
         join the toolbar below. The overlap belongs to the list rather than to
         the tab: a tab poking out of a scrolling box would make it scroll
         vertically too. -->
    <div role="tablist" :aria-label="t('pixelStitch.projects.tabsLabel')" class="-mb-px flex min-w-0 items-end gap-0.5 overflow-x-auto overflow-y-hidden">
      <div
        v-for="project in projects.openProjects.value"
        :key="project.id"
        class="relative flex h-9 w-[220px] min-w-[120px] shrink rounded-t-[10px] border border-b-0"
        :class="project.id === projects.activeId.value
          ? 'h-[37px] border-default bg-muted text-highlighted before:absolute before:inset-x-2.5 before:-top-px before:h-0.5 before:rounded-b-sm before:bg-primary'
          : 'border-transparent text-muted hover:bg-accented/70'"
      >
        <UInput
          v-if="renaming === project.id"
          ref="renameInput"
          v-model="draft"
          :maxlength="PROJECT_NAME_MAX"
          :aria-label="t('pixelStitch.projects.rename')"
          size="sm"
          class="my-auto ml-2 mr-1 min-w-0 grow"
          :ui="{ base: 'h-[26px] rounded-md px-2 text-[13px] font-semibold' }"
          @blur="commitRename"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="cancelRename"
        />
        <UTooltip v-else :text="project.name" :content="{ side: 'bottom' }" class="min-w-0 grow">
          <!-- The wrapper paints the tab's hover and selected state, so the
               button's own ghost fills are cleared rather than stacked on it. -->
          <UButton
            :ref="element => setTabRef(project.id, element)"
            role="tab"
            color="neutral"
            variant="ghost"
            :aria-selected="project.id === projects.activeId.value"
            :tabindex="project.id === projects.activeId.value ? 0 : -1"
            :aria-label="t('pixelStitch.projects.tabLabel', { name: project.name, size: `${project.canvasSize}×${project.canvasSize}` })"
            class="h-full w-full min-w-0 gap-2 rounded-none rounded-t-[10px] pl-3 pr-1 text-left text-inherit hover:bg-transparent active:bg-transparent focus-visible:bg-transparent"
            @click="projects.activate(project.id)"
            @dblclick="startRename(project.id)"
            @keydown="onTabKeyDown($event, project.id)"
          >
            <UBadge
              :label="String(project.canvasSize)"
              :color="project.id === projects.activeId.value ? 'primary' : 'neutral'"
              :variant="project.id === projects.activeId.value ? 'soft' : 'subtle'"
              size="sm"
              class="shrink-0 tabular-nums"
              aria-hidden="true"
            />
            <span class="truncate text-[13px] font-semibold">{{ project.name }}</span>
          </UButton>
        </UTooltip>
        <UTooltip :text="t('pixelStitch.projects.closeTooltip')" :content="{ side: 'bottom' }">
          <UButton
            icon="lucide:x"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('pixelStitch.projects.close', { name: project.name })"
            class="my-auto mr-1.5 size-6 shrink-0 justify-center rounded-md text-dimmed"
            @click="projects.close(project.id)"
          />
        </UTooltip>
      </div>

      <!-- While the start screen is up it is the tab in front, so the strip
           says where the artist is instead of showing no tab selected. -->
      <div
        v-if="startShowing"
        class="relative flex h-[37px] w-[180px] shrink-0 rounded-t-[10px] border border-b-0 border-default bg-muted text-highlighted before:absolute before:inset-x-2.5 before:-top-px before:h-0.5 before:rounded-b-sm before:bg-primary"
      >
        <span
          role="tab"
          aria-selected="true"
          tabindex="0"
          class="flex min-w-0 grow items-center gap-2 pl-3 text-[13px] font-semibold"
        >
          <UIcon name="lucide:sparkles" class="size-4 shrink-0" />
          <span class="truncate">{{ t('pixelStitch.projects.newTab') }}</span>
        </span>
        <UButton
          v-if="projects.openIds.value.length"
          icon="lucide:x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('pixelStitch.projects.closeNewTab')"
          class="my-auto mr-1.5 size-6 shrink-0 justify-center rounded-md text-dimmed"
          @click="projects.closeStart()"
        />
      </div>
    </div>

    <UTooltip :text="t('pixelStitch.projects.new')" :content="{ side: 'bottom' }">
      <UButton
        icon="lucide:plus"
        color="neutral"
        variant="ghost"
        :aria-label="t('pixelStitch.projects.new')"
        :aria-pressed="startShowing"
        class="mb-[3px] size-8 shrink-0 justify-center rounded-lg"
        :class="startShowing ? 'bg-accented text-highlighted' : 'text-muted'"
        @click="projects.showStart()"
      />
    </UTooltip>
  </nav>
</template>
