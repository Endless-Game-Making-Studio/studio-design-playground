<script setup lang="ts">
// Guests get the same band, so the page below doesn't shift depending on who's
// looking — only the right-hand side changes, and the account props go unused.
defineProps<{
  guest?: boolean
  xpLabel?: string
  streakDays?: number
  userName?: string
  userAvatar?: string
  notificationCount?: number
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
