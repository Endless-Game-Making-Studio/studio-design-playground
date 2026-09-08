<script setup lang="ts">
import { usePatchWorkShop } from '~/composables/usePatchWorkShop'
import { providePatchWorkShop } from '~/composables/usePatchWorkShopContext'

definePageMeta({ layout: 'tool' })

const { t } = useI18n()
useHead({ title: () => t('patchworkshop.title') })

providePatchWorkShop(usePatchWorkShop())
</script>

<template>
  <div class="flex min-h-0 grow">
    <aside class="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-default bg-slate-50">
      <PatchWorkShopAssetLibrary />
    </aside>

    <main class="flex min-w-0 grow flex-col bg-slate-50">
      <PatchWorkShopCanvas />
    </main>
  </div>
</template>
