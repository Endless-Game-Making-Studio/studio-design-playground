<script setup lang="ts">
import type { MentorClassroom } from '~/composables/useProgramMockData'
import { avatarForName } from '~/composables/useProgramMockData'
import { userName, userAvatar } from '~/composables/useHomeMockData'

// Prop-driven, not route-driven like ProgramTab*.vue's siblings: the selected
// classroom is local UI state (a sidebar pick), not a URL segment.
defineProps<{
  classroom: MentorClassroom
}>()

const { t } = useI18n()

const inviteModalOpen = ref(false)
</script>

<template>
  <div class="mt-8 flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted">
        {{ t('teach.hub.users.count', { count: classroom.learners.length }, classroom.learners.length) }}
      </p>
      <UButton
        :label="t('teach.hub.users.invite')"
        icon="lucide:user-plus"
        color="primary"
        variant="soft"
        @click="inviteModalOpen = true"
      />
    </div>

    <!-- `divide-y` rather than USeparator between rows: a <ul> may only
         contain <li>, so a separator component sitting between the items
         would be invalid markup a screen reader has to step over. -->
    <ul class="flex flex-col divide-y divide-default">
      <!-- The mentor heads their own roster: the list is "everyone in this
           classroom", and leaving out the person reading it is confusing. -->
      <li class="flex items-center gap-3 py-2.5">
        <UAvatar :src="userAvatar" :alt="userName" :text="userName.charAt(0)" size="sm" />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold text-default">{{ userName }}</span>
        <UBadge :label="t('teach.hub.users.mentorRole')" color="secondary" variant="subtle" size="sm" />
      </li>

      <li
        v-for="learner in classroom.learners"
        :key="learner.name"
        class="flex items-center gap-3 py-2.5"
      >
        <UAvatar :src="avatarForName(learner.name)" :alt="learner.name" :text="learner.name.charAt(0)" size="sm" />
        <span class="min-w-0 flex-1 truncate text-sm text-default">{{ learner.name }}</span>
        <UBadge :label="t('teach.hub.users.learnerRole')" color="neutral" variant="subtle" size="sm" />
      </li>
    </ul>

    <TeachClassroomInviteModal v-model:open="inviteModalOpen" :classroom="classroom" />
  </div>
</template>
