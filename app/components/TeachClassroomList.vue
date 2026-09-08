<script setup lang="ts">
import type { MentorClassroom } from '~/composables/useProgramMockData'
import { programTemplates } from '~/composables/useProgramMockData'

const props = defineProps<{
  classrooms: MentorClassroom[]
}>()

const selected = defineModel<string>({ required: true })

const { t } = useI18n()

function programTitle(programId: string) {
  return programTemplates.find(template => template.id === programId)?.title ?? ''
}

const ALL_PROGRAMS = 'all'
const programFilter = ref<string>(ALL_PROGRAMS)

// Built from the classrooms the mentor actually runs, not the full catalog —
// a filter offering programs with nothing behind them is just dead options.
const programOptions = computed(() => [
  { label: t('teach.hub.sidebar.allPrograms'), value: ALL_PROGRAMS },
  ...[...new Set(props.classrooms.map(classroom => classroom.programId))]
    .map(id => ({ label: programTitle(id), value: id }))
    .sort((a, b) => a.label.localeCompare(b.label))
])

const visibleClassrooms = computed(() =>
  programFilter.value === ALL_PROGRAMS
    ? props.classrooms
    : props.classrooms.filter(classroom => classroom.programId === programFilter.value)
)

// Filtering out the selected classroom would leave the detail panel showing
// something the mentor can no longer see in the list — move the selection to
// the first classroom that survived the filter instead.
watch(visibleClassrooms, (list) => {
  if (list.length && !list.some(classroom => classroom.id === selected.value)) {
    selected.value = list[0]!.id
  }
})
</script>

<template>
  <!-- Same card shell as LearnFilterSidebar.vue (UCard as="aside", same
       rounding/sticky/background) so the two hub pages' side menus read as
       one platform pattern rather than two different sidebar styles. -->
  <UCard as="aside" variant="subtle" class="rounded-[20px] lg:sticky lg:top-24" :ui="{ root: 'bg-elevated/55', body: 'flex flex-col gap-5 p-5' }">
    <div v-if="classrooms.length">
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-dimmed">
        {{ t('teach.hub.sidebar.program') }}
      </h3>
      <USelect v-model="programFilter" :items="programOptions" class="w-full" />
    </div>

    <div>
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-dimmed">
        {{ t('teach.hub.sidebar.classrooms') }}
      </h3>

      <p v-if="!visibleClassrooms.length" class="text-sm text-muted">
        {{ t('teach.hub.sidebar.listEmpty') }}
      </p>

      <nav v-else class="flex flex-col gap-1">
        <button
          v-for="classroom in visibleClassrooms"
          :key="classroom.id"
          type="button"
          class="flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors"
          :class="classroom.id === selected
            ? 'bg-default text-highlighted shadow-sm'
            : 'text-muted hover:bg-default/70 hover:text-highlighted'"
          :aria-current="classroom.id === selected ? 'true' : undefined"
          @click="selected = classroom.id"
        >
          <span class="flex items-center gap-2">
            <span class="truncate flex-1 text-sm font-semibold">{{ classroom.name }}</span>
            <UBadge
              v-if="classroom.maxLearners"
              :label="`${classroom.seatsTaken}/${classroom.maxLearners}`"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </span>
          <span class="truncate text-xs text-muted">{{ programTitle(classroom.programId) }}</span>
        </button>
      </nav>
    </div>

    <USeparator />

    <nav class="flex flex-col gap-1">
      <UButton
        :label="t('teach.hub.sidebar.newClassroom')"
        icon="lucide:plus"
        to="/teach/new"
        color="secondary"
        variant="ghost"
        block
        :ui="{ base: 'justify-start px-3 py-2 font-semibold' }"
      />
      <UButton
        :label="t('teach.hub.sidebar.mentorTraining')"
        icon="lucide:graduation-cap"
        to="/learn/educator-training"
        color="secondary"
        variant="ghost"
        block
        :ui="{ base: 'justify-start px-3 py-2 font-semibold' }"
      />
    </nav>
  </UCard>
</template>
