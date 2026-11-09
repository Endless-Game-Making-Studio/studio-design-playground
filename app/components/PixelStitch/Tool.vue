<script setup lang="ts">
import { providePixelStitchProjects, usePixelStitchProjects } from '~/composables/usePixelStitchProjects'

// The whole tool below any top bar. The platform page wraps it in the
// platform's bar; the desktop build shows it on its own. It must stay free of
// platform chrome and of the preview state, which the desktop build leaves out.
const projects = usePixelStitchProjects()
providePixelStitchProjects(projects)
</script>

<template>
  <!-- Nothing renders until storage has been read: showing the start screen
       first would flash it at someone whose tabs are about to come back. -->
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
</template>
