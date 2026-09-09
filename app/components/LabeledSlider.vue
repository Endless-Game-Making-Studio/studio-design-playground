<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  min: number
  max: number
  step: number
  /** Right-hand readout. Each slider spells out its own unit — a percentage, a raw BPM, a signed semitone count. */
  readout: string
  disabled?: boolean
}>(), { disabled: false })

const value = defineModel<number>({ required: true })
</script>

<template>
  <!-- Width comes from the caller: these sit in a wrap-around toolbar where
       each control is sized to the range it covers. -->
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between text-xs text-muted">
      <span>{{ label }}</span>
      <span class="font-semibold tabular-nums text-highlighted">{{ readout }}</span>
    </div>
    <USlider
      v-model="value"
      :min="min"
      :max="max"
      :step="step"
      size="sm"
      :disabled="disabled"
      :aria-label="label"
    />
  </div>
</template>
