<script setup lang="ts">
// Guests get the same band, so the page below doesn't shift depending on who's
// looking — only the right-hand side changes, and the account props go unused.
const props = defineProps<{
  guest?: boolean
  xpLabel?: string
  streakDays?: number
  userName?: string
  userAvatar?: string
  notificationCount?: number
  // The maker tools own the whole window rather than sitting in the dashboard's
  // page container, so their bar spans it edge to edge and carries the logo and
  // the tool switcher itself. The account cluster stays shared either way.
  fullBleed?: boolean
}>()

defineSlots<{
  left?: () => unknown
  center?: () => unknown
}>()
</script>

<template>
  <!-- The tinted band is full-bleed across the panel, but the bar's own contents
       stay inside the page container so they line up with the content below
       instead of hugging the viewport edge. -->
  <div class="w-full bg-default/65 backdrop-blur border-b border-default">
    <UDashboardNavbar :ui="{ root: 'w-full max-w-(--ui-container) mx-auto px-4 sm:px-6 lg:px-8 border-b-0' }">
      <template #right>
        <AppAccountCluster v-bind="$props" />
      </template>
    </UDashboardNavbar>
  </div>
</template>
