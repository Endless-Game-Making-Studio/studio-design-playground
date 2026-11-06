<script setup lang="ts">
import { providePixelStitchProjects, usePixelStitchProjects } from '~/composables/usePixelStitchProjects'
import { topbarStatsFor, userAvatar, userName } from '~/composables/useHomeMockData'
import { usePreviewState } from '~/composables/usePreviewState'
import { useXpBalance } from '~/composables/useXpBalance'

definePageMeta({ layout: false })

const { t } = useI18n()
const projects = usePixelStitchProjects()
providePixelStitchProjects(projects)

// The tool owns the window, but the account cluster in its top bar is the
// platform's — the same component and the same counters as every dashboard
// page, so a fix there lands here too.
const { isLoggedIn, isOnboarded } = usePreviewState()
const { total: xpTotal } = useXpBalance()
const topbarStats = computed(() => topbarStatsFor(isOnboarded.value, xpTotal.value))
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-slate-50">
    <!-- The platform's bar, full-bleed: the logo and the tool switcher on the
         left and in the middle, the account cluster it already owns on the
         right. -->
    <AppTopbar
      v-if="isLoggedIn"
      v-bind="topbarStats"
      full-bleed
      :user-name="userName"
      :user-avatar="userAvatar"
    >
      <template #left>
        <NuxtLink to="/make" :aria-label="t('pixelStitch.backToTools')">
          <img src="/images/endless-logo-horizontal.svg" alt="Endless Studios" width="114" height="31">
        </NuxtLink>
      </template>
      <template #center>
        <PixelStitchToolSwitcher tool-id="pixel-stitch" icon="lucide:pencil" />
      </template>
    </AppTopbar>
    <AppTopbar v-else guest full-bleed>
      <template #left>
        <NuxtLink to="/make" :aria-label="t('pixelStitch.backToTools')">
          <img src="/images/endless-logo-horizontal.svg" alt="Endless Studios" width="114" height="31">
        </NuxtLink>
      </template>
      <template #center>
        <PixelStitchToolSwitcher tool-id="pixel-stitch" icon="lucide:pencil" />
      </template>
    </AppTopbar>

    <!-- Nothing below the bar renders until storage has been read: showing the
         start screen first would flash it at someone whose tabs are about to
         come back. -->
    <ClientOnly>
      <template v-if="projects.ready.value">
        <PixelStitchProjectTabs />

        <PixelStitchStartScreen
          v-if="projects.activeId.value === null"
          role="tabpanel"
        />

        <!-- Every open tab stays mounted, hidden while another is in front, so
             its undo history, zoom and selection survive a switch. -->
        <PixelStitchWorkspace
          v-for="id in projects.openIds.value"
          v-show="id === projects.activeId.value"
          :key="id"
          :project-id="id"
          :active="id === projects.activeId.value"
          role="tabpanel"
        />
      </template>
    </ClientOnly>
  </div>
</template>
