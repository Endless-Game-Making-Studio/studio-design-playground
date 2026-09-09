<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'
import { MotionConfig } from 'motion-v'

const { locale } = useI18n()
</script>

<template>
  <!-- main.css's `prefers-reduced-motion` block only reaches CSS transitions and
       animations; motion-v drives the reorder and drag moves from JS, and its own
       default is `never` — it ignores the preference until told otherwise. One
       wrapper here covers every Motion/Reorder in the app, so a component can't
       be added later that quietly opts out. -->
  <MotionConfig reduced-motion="user">
    <UApp :locale="locales[locale]">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </MotionConfig>
</template>
