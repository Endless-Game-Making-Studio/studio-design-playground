<script setup lang="ts">
import { toolMenuGroups } from '~/composables/useMakeMockData'
import { userName, userAvatar, topbarStatsFor } from '~/composables/useHomeMockData'
import { useXpBalance } from '~/composables/useXpBalance'
import { usePreviewState } from '~/composables/usePreviewState'

// The bar for a tool tab: the platform's account block on the right, the
// Endless mark on the left, and the tool switcher in the middle. It carries no
// sidebar — the tab is the tool, and the switcher is the only navigation.
const route = useRoute()
const { isLoggedIn, isOnboarded } = usePreviewState()
const { total: xpTotal } = useXpBalance()
const topbarStats = computed(() => topbarStatsFor(isOnboarded.value, xpTotal.value))

const tools = toolMenuGroups.flatMap(group => group.tools)

// Read off the route rather than taken as a prop: a tool page only has to name
// the layout, and a page that isn't a tool (a stray direct visit) still gets a
// working bar, just with nothing selected.
const currentTool = computed(() => tools.find(tool => tool.href === route.path))

const open = ref(false)

// Switching tools navigates this tab rather than opening yet another one — each
// of these was already opened in a tab of its own from the Make page.
watch(() => route.path, () => (open.value = false))
</script>

<template>
  <!-- Full-bleed, unlike the platform's bar: there is no page container to line
       up with here, and the tool below uses the whole width. -->
  <div class="w-full bg-default/65 backdrop-blur border-b border-default">
    <div class="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="shrink-0" aria-label="Endless Studios home">
        <img src="/images/endless-logo-horizontal.svg" alt="Endless Studios" width="114" height="31" class="dark:hidden">
        <img src="/images/endless-logo-horizontal-dark.svg" alt="Endless Studios" width="114" height="31" class="hidden dark:block">
      </NuxtLink>

      <div class="flex min-w-0 flex-1 justify-center">
        <!-- `collisionPadding: 0` and a `w-screen` panel: the trigger is centred
             in a full-width bar, so a viewport-wide panel centred on it lands
             flush with both edges — and the rounding and side borders come off,
             since it has no edges of its own to show. -->
        <UPopover
          v-model:open="open"
          :content="{ align: 'center', sideOffset: 1, collisionPadding: 0 }"
          :ui="{ content: 'w-screen max-w-none rounded-none border-x-0' }"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            trailing-icon="lucide:chevron-down"
            class="w-full max-w-80 justify-between"
            aria-label="Switch tool"
          >
            <span class="truncate">{{ currentTool?.name ?? 'Maker Tools' }}</span>
          </UButton>

          <template #content>
            <div class="mx-auto w-full max-w-(--ui-container) px-4 py-6 sm:px-6 lg:px-8">
              <div class="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                <div v-for="group in toolMenuGroups" :key="group.id" class="flex flex-col gap-1">
                  <p class="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
                    {{ group.label }}
                  </p>

                  <UButton
                    v-for="tool in group.tools"
                    :key="tool.id"
                    block
                    :to="tool.href"
                    :target="tool.external ? '_blank' : undefined"
                    :disabled="!tool.href"
                    color="neutral"
                    :variant="tool.id === currentTool?.id ? 'soft' : 'ghost'"
                    class="h-auto justify-start gap-3 py-2"
                  >
                    <span
                      class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      :style="tool.image ? undefined : { background: tool.logoBg }"
                    >
                      <img v-if="tool.image" :src="tool.image" alt="" class="size-full object-cover">
                      <img v-else-if="tool.logo" :src="tool.logo" alt="" class="size-5">
                      <UIcon v-else-if="tool.icon" :name="tool.icon" class="size-5 text-white" />
                    </span>

                    <span class="min-w-0 flex-1 text-left">
                      <span class="block text-sm font-semibold text-highlighted">{{ tool.name }}</span>
                      <span v-if="tool.tag" class="block truncate text-xs text-dimmed">{{ tool.tag }}</span>
                    </span>

                    <!-- Only one of the two ever shows: a tool that leaves the
                         platform can't be the one you're in. -->
                    <UIcon v-if="tool.external" name="lucide:external-link" class="size-4 shrink-0 text-dimmed" />
                    <UBadge
                      v-else-if="tool.id === currentTool?.id"
                      label="Open"
                      color="primary"
                      variant="soft"
                      size="sm"
                    />
                  </UButton>
                </div>
              </div>

              <USeparator class="my-4" />

              <UButton
                to="/make"
                icon="lucide:layout-grid"
                label="All maker tools"
                color="neutral"
                variant="link"
                class="-ml-2"
              />
            </div>
          </template>
        </UPopover>
      </div>

      <AppAccountCluster
        v-if="isLoggedIn"
        v-bind="topbarStats"
        :user-name="userName"
        :user-avatar="userAvatar"
        class="shrink-0"
      />
      <AppAccountCluster v-else guest class="shrink-0" />
    </div>
  </div>
</template>
