<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { tailorApps } from '~/composables/useMakeMockData'

const props = defineProps<{
  toolId: string
  icon: string
}>()

const current = computed(() => tailorApps.find(tool => tool.id === props.toolId))

// The other maker tools, so the switcher answers "where am I and where else can
// I go" in one control. Only the ones the platform renders itself get a route;
// the rest still leave, and the menu says so with the external-link arrow.
const items = computed<DropdownMenuItem[]>(() =>
  tailorApps
    .filter(tool => tool.id !== props.toolId)
    .map(tool => ({
      label: tool.name,
      icon: tool.icon ?? 'lucide:wrench',
      to: tool.route ?? tool.url,
      target: tool.route ? undefined : '_blank'
    }))
)
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'center' }" :ui="{ content: 'w-[340px]' }">
    <UButton color="neutral" variant="outline" trailing-icon="lucide:chevron-down" class="h-10 w-[340px] justify-start gap-2.5 px-3 text-sm">
      <span class="grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-slate-100">
        <Icon :name="icon" class="size-[13px] text-dimmed" />
      </span>
      <span class="grow text-left text-default">{{ current?.name }}</span>
    </UButton>
  </UDropdownMenu>
</template>
