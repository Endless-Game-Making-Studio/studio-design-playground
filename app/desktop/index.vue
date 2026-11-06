<script setup lang="ts">
// The desktop build's only route: the tool and nothing of the platform around
// it — no top bar, account, XP, tool switcher or preview-state pill.
definePageMeta({ layout: false })
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-slate-50">
    <PixelStitchTool />
  </div>
</template>
