<template>
  <!-- A tool tab stands outside the platform's menu structure: no
       UDashboardGroup, no sidebar, so a page here is a plain document that
       scrolls (or a frame that fills what's left under the bar). -->
  <div class="flex min-h-svh flex-col bg-default">
    <ToolTopbar />

    <main class="flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
  </div>
</template>
