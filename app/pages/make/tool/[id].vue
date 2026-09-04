<script setup lang="ts">
import { embeddableTools } from '~/composables/useMakeMockData'

// The tools that aren't built on this stack yet still open as their own tab
// with the platform's bar on top — the frame that used to sit in a drawer over
// the Make page lives here instead, so the switcher is reachable from inside
// every tool rather than only from the platform.
definePageMeta({ layout: 'tool' })

const route = useRoute()
const tool = computed(() => embeddableTools.find(entry => entry.id === route.params.id))

// A bad id, or a tool that only ever had an outward link: there is nothing to
// frame, and a blank tab with a bar on top would look like a broken tool.
if (!tool.value) {
  throw createError({ statusCode: 404, statusMessage: 'No such tool', fatal: true })
}

useHead({ title: () => tool.value?.name ?? 'Maker Tools' })

// A cross-origin frame can't be inspected, so this only tracks "the load event
// fired" — enough to clear the spinner, not enough to know the tool rendered.
const loaded = ref(false)
</script>

<template>
  <div class="relative min-h-0 flex-1">
    <!-- Pinned with `absolute inset-0` rather than left to `h-full`: an iframe
         has no intrinsic height, and a percentage height against a flex-sized
         parent collapses it to the default 150px.

         No `sandbox` attribute. These are first-party Endless Studios tools,
         and a sandbox missing `allow-downloads`/`allow-popups`/
         `allow-same-origin` silently breaks export and localStorage in a
         canvas app — on a trusted origin those are what we'd grant anyway. -->
    <iframe
      v-if="tool?.embedUrl"
      :key="tool.id"
      :src="tool.embedUrl"
      :title="tool.name"
      class="absolute inset-0 size-full border-0"
      allow="clipboard-read; clipboard-write; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin"
      @load="loaded = true"
    />

    <!-- A spinner rather than a skeleton: a third-party embed can take several
         seconds, and a shimmer that long reads as something broken. -->
    <div v-if="!loaded" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-elevated">
      <UIcon name="lucide:loader-circle" class="size-6 animate-spin text-dimmed" />
      <p class="text-sm text-muted">Loading {{ tool?.name }}…</p>
    </div>

    <!-- Always present by design: a frame blocked upstream still fires `load`
         and renders blank, and nothing cross-origin can detect that — so this
         is the learner's only way out, and it has to be findable. -->
    <UButton
      v-if="tool?.url"
      :to="tool.url"
      target="_blank"
      label="Open in a new tab"
      icon="lucide:external-link"
      color="neutral"
      variant="outline"
      size="sm"
      class="absolute bottom-4 right-4 shadow-lg"
    />
  </div>
</template>
