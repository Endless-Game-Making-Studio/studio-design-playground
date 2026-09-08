<script setup lang="ts">
import { NOTES, SOUND_EFFECTS, STEPS, TOTAL_ROWS } from '~/composables/melodyLoom/types'
import { rowCellStates, type CellVisualState } from '~/composables/melodyLoom/sequencer'
import { useMelodyLoomContext } from '~/composables/useMelodyLoomContext'

const editor = useMelodyLoomContext()
const { t } = useI18n()

interface Cell {
  row: number
  col: number
  state: CellVisualState
  isBarEnd: boolean
}

// One states array per row, recomputed only when the grid or durations
// actually change. The playhead column is applied separately, as a class
// keyed off `currentStep`, so playback doesn't force this to recompute every
// tick — it only touches which cells carry the highlight class.
const allRowStates = computed<CellVisualState[][]>(() =>
  Array.from({ length: TOTAL_ROWS }, (_, row) => rowCellStates(editor.grid.value, editor.noteDurations, row))
)

function toCells(rowStart: number, rowCount: number): Cell[] {
  const cells: Cell[] = []
  for (let row = rowStart; row < rowStart + rowCount; row++) {
    const states = allRowStates.value[row]!
    for (let col = 0; col < STEPS; col++) {
      const state = states[col]!
      const next = states[col + 1]
      cells.push({
        row,
        col,
        state,
        // A tied note renders as one continuous bar — rounded only at its true
        // start and true end, flat everywhere it's sustaining through.
        isBarEnd: state !== 'empty' && (next === undefined || next === 'empty' || next === 'start')
      })
    }
  }
  return cells
}

const noteCells = computed(() => toCells(0, NOTES))
const effectCells = computed(() => toCells(NOTES, SOUND_EFFECTS))

const gridTemplateColumns = `repeat(${STEPS}, minmax(18px, 1fr))`

function cellClasses(cell: Cell, accent: 'primary' | 'secondary') {
  return [
    'aspect-square border border-default/60 transition-colors',
    cell.state === 'empty'
      ? 'bg-default hover:bg-elevated'
      : accent === 'primary'
        ? 'bg-primary-500 hover:bg-primary-600'
        : 'bg-secondary-500 hover:bg-secondary-600',
    cell.state === 'start' ? 'rounded-l-[4px]' : '',
    cell.isBarEnd ? 'rounded-r-[4px]' : '',
    // Playing only: a resting cursor over the grid shouldn't look like a beat is landing.
    editor.isPlaying.value && cell.col === editor.currentStep.value ? 'ring-2 ring-inset ring-warning' : ''
  ]
}

function cellLabel(cell: Cell) {
  return t('melodyLoom.grid.cellLabel', { row: cell.row + 1, step: cell.col + 1 })
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 overflow-x-auto p-4">
    <section class="flex flex-col gap-1.5">
      <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
        {{ t('melodyLoom.grid.notesLabel') }}
      </p>
      <div class="grid gap-0.5" :style="{ gridTemplateColumns }">
        <button
          v-for="cell in noteCells"
          :key="`${cell.row}-${cell.col}`"
          type="button"
          :class="cellClasses(cell, 'primary')"
          :aria-label="cellLabel(cell)"
          :aria-pressed="cell.state !== 'empty'"
          @click="editor.toggleCell(cell.row, cell.col)"
        />
      </div>
    </section>

    <USeparator />

    <section class="flex flex-col gap-1.5">
      <p class="px-1 text-xs font-semibold uppercase tracking-wide text-dimmed">
        {{ t('melodyLoom.grid.effectsLabel') }}
      </p>
      <div class="grid gap-0.5" :style="{ gridTemplateColumns }">
        <button
          v-for="cell in effectCells"
          :key="`${cell.row}-${cell.col}`"
          type="button"
          :class="cellClasses(cell, 'secondary')"
          :aria-label="cellLabel(cell)"
          :aria-pressed="cell.state !== 'empty'"
          @click="editor.toggleCell(cell.row, cell.col)"
        />
      </div>
    </section>
  </div>
</template>
