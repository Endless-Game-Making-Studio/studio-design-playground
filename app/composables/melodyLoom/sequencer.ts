import { DURATION_STEPS, STEPS } from '~/composables/melodyLoom/types'

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

// The grid is a 16th-note one, so a column lasts a quarter of a beat.
const STEPS_PER_BEAT = 4
const SECONDS_PER_MINUTE = 60

/** How long one grid column lasts. Live playback and the offline render both ask, so they can't drift apart. */
export function stepSeconds(bpm: number): number {
  return SECONDS_PER_MINUTE / (bpm * STEPS_PER_BEAT)
}

/**
 * There's no separate "note" object — whether `col` starts a new note or is
 * silently part of an earlier tied note is decided by walking backward
 * through the row. The recursive check on the candidate column is what makes
 * this safe: a column covered by an earlier click can itself be buried by a
 * still-earlier note, in which case it never sounded and can't extend its own
 * cover forward, so the scan keeps walking past it rather than stopping there.
 * Shared by playback and rendering so the two can't disagree about what's
 * actually audible.
 */
export function isNoteStart(grid: boolean[][], noteDurations: Map<string, number>, row: number, col: number): boolean {
  if (!grid[row]?.[col]) return false

  for (let c = col - 1; c >= 0; c--) {
    if (!grid[row]?.[c]) continue
    if (!isNoteStart(grid, noteDurations, row, c)) continue
    const duration = noteDurations.get(cellKey(row, c)) ?? 1
    return c + duration <= col
  }

  return true
}

export type CellVisualState = 'empty' | 'start' | 'sustain'

/** One pass per row for the grid to render — a filled bar spanning each note's duration, not just its start cell. */
export function rowCellStates(grid: boolean[][], noteDurations: Map<string, number>, row: number): CellVisualState[] {
  const states: CellVisualState[] = []
  let sustainUntil = 0

  for (let col = 0; col < STEPS; col++) {
    if (col < sustainUntil) {
      states.push('sustain')
      continue
    }
    if (isNoteStart(grid, noteDurations, row, col)) {
      const duration = noteDurations.get(cellKey(row, col)) ?? 1
      sustainUntil = col + duration
      states.push('start')
    } else {
      states.push('empty')
    }
  }

  return states
}

/**
 * Duration cycling for a click on `(row, col)`: off -> 1 -> 2 -> 4 -> 8 -> off.
 * Delete-mode collapses that to erase-only — a click there never cycles, it
 * only ever turns an active cell off (the caller is expected to no-op a
 * delete-mode click on an already-empty cell rather than call this at all).
 */
export function nextDuration(isActive: boolean, currentDuration: number, isDeleteMode: boolean): number | null {
  if (isDeleteMode) return null
  if (!isActive) return DURATION_STEPS[0]
  const index = DURATION_STEPS.indexOf(currentDuration as typeof DURATION_STEPS[number])
  return DURATION_STEPS[index + 1] ?? null
}

export function nextStep(step: number): number {
  return (step + 1) % STEPS
}
