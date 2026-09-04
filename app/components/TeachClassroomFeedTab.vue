<script setup lang="ts">
import type { MentorClassroom } from '~/composables/useProgramMockData'
import { avatarForName } from '~/composables/useProgramMockData'
import { userName, userAvatar } from '~/composables/useHomeMockData'
import { useMentorClassrooms } from '~/composables/useMentorClassrooms'

// Prop-driven, not route-driven like ProgramTab*.vue's siblings: the selected
// classroom is local UI state (a sidebar pick), not a URL segment.
const props = defineProps<{
  classroom: MentorClassroom
}>()

const { t } = useI18n()
const { postsFor, addPost } = useMentorClassrooms()

const posts = computed(() => postsFor(props.classroom))

function submit(body: string) {
  addPost(props.classroom.id, {
    // Only unique within one mentor's session — crypto.randomUUID() is
    // undefined outside secure contexts, and this app is routinely viewed
    // over plain http on a LAN IP (see useMentorClassrooms.ts).
    id: `draft-${props.classroom.id}-${Date.now().toString(36)}`,
    author: userName,
    time: t('program.community.justNow'),
    body,
    likes: 0,
    isMentor: true
  })
}
</script>

<template>
  <div class="mt-8 flex flex-col gap-6">
    <ProgramPostComposer :channel-name="classroom.name" @post="submit" />

    <template v-if="posts.length">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post-id="post.id"
        :author="post.author"
        :avatar="post.author === userName ? userAvatar : avatarForName(post.author)"
        :time="post.time"
        :likes="post.likes"
        :is-mentor="post.isMentor"
      >
        {{ post.body }}
      </PostCard>
    </template>

    <div
      v-else
      class="border-[1.5px] border-dashed border-default flex flex-col items-center gap-2 text-center rounded-2xl"
      style="padding: 32px 24px"
    >
      <UIcon name="lucide:message-square-dashed" class="size-[22px] text-primary" />
      <div class="font-heading text-[15px] font-bold text-default">{{ t('teach.hub.feed.empty.title') }}</div>
      <p class="m-0 max-w-[360px] text-[13px] leading-5 text-muted">{{ t('teach.hub.feed.empty.body') }}</p>
    </div>
  </div>
</template>
