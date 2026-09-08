import type { MelodicInstrument, PresetPack, RowInstrument, SoundEffectId } from '~/composables/melodyLoom/types'
import { NOTE_FREQUENCIES, NOTES, STEPS, TOTAL_ROWS } from '~/composables/melodyLoom/types'
import { INSTRUMENTS, PRESETS, playMelodicNote, playSoundEffect } from '~/composables/melodyLoom/instruments'
import { createReverbBus, type ReverbBus } from '~/composables/melodyLoom/reverb'
import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { cellKey, isNoteStart, nextDuration, nextStep } from '~/composables/melodyLoom/sequencer'

function emptyGrid(): boolean[][] {
  return Array.from({ length: TOTAL_ROWS }, () => Array<boolean>(STEPS).fill(false))
}

function rowsForPreset(preset: Exclude<PresetPack, 'custom'>): RowInstrument[] {
  const definition = PRESETS[preset]
  return [...definition.melodic, ...definition.effects]
}

const DEFAULT_PRESET: Exclude<PresetPack, 'custom'> = '8bit'

// 4 steps per beat (a 16th-note grid) at the given BPM — don't "simplify" this
// constant, the 250 and the 4-steps-per-beat reading of it are the same fact.
const MS_PER_BEAT_STEP = 250

/**
 * Melody Loom's sequencer core: the grid, the transport, and the Web Audio
 * graph that plays it. One instance per page, provided via
 * `useMelodyLoomContext`, mirroring Pixel Stitch's shape — every panel acts on
 * the same cursor (here, the same grid and playhead) rather than each holding
 * a slice of its own.
 */
export function useMelodyLoom() {
  const grid = ref<boolean[][]>(emptyGrid())
  // Reactive Map (not a ref<Map>) so `.set`/`.delete` calls are tracked without
  // reassigning the whole map on every cell click.
  const noteDurations = reactive(new Map<string, number>())

  const rowInstruments = ref<RowInstrument[]>(rowsForPreset(DEFAULT_PRESET))
  const currentPreset = ref<PresetPack>(DEFAULT_PRESET)

  const isPlaying = ref(false)
  const currentStep = ref(0)
  const bpm = ref(120)
  const volume = ref(0.8)
  const reverbAmount = ref(0.3)
  const isDeleteMode = ref(false)

  // ─── Audio graph ──────────────────────────────────────────────────────────
  // Built lazily on first play, never at composable-creation time — nothing
  // here may touch `AudioContext` before a real user gesture has unlocked it
  // (see melodyLoom/audioContext.ts), and it doesn't exist at all during SSR.
  let audioCtx: AudioContext | null = null
  let reverbBus: ReverbBus | null = null

  function ensureAudioGraph() {
    if (!audioCtx || !reverbBus) {
      audioCtx = getSharedAudioContext()
      reverbBus = createReverbBus(audioCtx, audioCtx.destination)
      reverbBus.setAmount(reverbAmount.value)
    }
    return { ctx: audioCtx, bus: reverbBus }
  }

  watch(reverbAmount, (amount) => reverbBus?.setAmount(amount))

  // ─── Grid editing ─────────────────────────────────────────────────────────

  function toggleCell(row: number, col: number) {
    const key = cellKey(row, col)
    const active = grid.value[row]?.[col] ?? false
    const current = noteDurations.get(key) ?? 1
    const next = nextDuration(active, current, isDeleteMode.value)

    if (next === null) {
      // A delete-mode click on an empty cell has nothing to erase.
      if (!active) return
      grid.value[row]![col] = false
      noteDurations.delete(key)
      return
    }

    grid.value[row]![col] = true
    noteDurations.set(key, next)
  }

  function clearGrid() {
    grid.value = emptyGrid()
    noteDurations.clear()
  }

  function toggleDeleteMode() {
    isDeleteMode.value = !isDeleteMode.value
  }

  // ─── Presets ──────────────────────────────────────────────────────────────

  function applyPreset(preset: PresetPack) {
    currentPreset.value = preset
    // 'custom' has no fixed mapping of its own — it's only ever the label for
    // "the rows no longer match any preset", set here as a no-op selection and
    // set automatically once #30-era per-row editing exists.
    if (preset === 'custom') return
    rowInstruments.value = rowsForPreset(preset)
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  function stepIntervalMs() {
    return (60 / bpm.value) * MS_PER_BEAT_STEP
  }

  function playRowsAtStep(step: number) {
    const { ctx, bus } = ensureAudioGraph()
    const stepSeconds = stepIntervalMs() / 1000
    const startTime = ctx.currentTime

    for (let row = 0; row < TOTAL_ROWS; row++) {
      if (!isNoteStart(grid.value, noteDurations, row, step)) continue
      const instrument = rowInstruments.value[row]!

      if (row < NOTES) {
        const durationSteps = noteDurations.get(cellKey(row, step)) ?? 1
        playMelodicNote(
          ctx,
          INSTRUMENTS[instrument as MelodicInstrument],
          NOTE_FREQUENCIES[row]!,
          startTime,
          durationSteps * stepSeconds,
          volume.value,
          bus.dryGain,
          bus.wetGain
        )
      } else {
        playSoundEffect(ctx, instrument as SoundEffectId, startTime, volume.value, bus.dryGain, bus.wetGain)
      }
    }
  }

  let playbackTimer: ReturnType<typeof setInterval> | null = null

  function stopTimer() {
    if (playbackTimer) clearInterval(playbackTimer)
    playbackTimer = null
  }

  // Re-created whenever bpm changes, so dragging the tempo retimes a run
  // already under way instead of waiting for the next play (mirrors Pixel
  // Stitch's fps-driven playback timer).
  watch([isPlaying, bpm], ([playing], previous) => {
    stopTimer()
    if (!playing) return

    const wasPlaying = previous?.[0] ?? false
    // Play the current step right away rather than waiting a full interval —
    // pressing Play should be heard immediately, not on the first tick.
    if (!wasPlaying) playRowsAtStep(currentStep.value)

    playbackTimer = setInterval(() => {
      currentStep.value = nextStep(currentStep.value)
      playRowsAtStep(currentStep.value)
    }, stepIntervalMs())
  })

  function play() {
    if (isPlaying.value) return
    ensureAudioGraph()
    isPlaying.value = true
  }

  function pause() {
    isPlaying.value = false
  }

  function stop() {
    isPlaying.value = false
    currentStep.value = 0
  }

  onBeforeUnmount(stopTimer)

  return {
    grid,
    noteDurations,
    rowInstruments,
    currentPreset,
    isPlaying,
    currentStep,
    bpm,
    volume,
    reverbAmount,
    isDeleteMode,
    toggleCell,
    clearGrid,
    toggleDeleteMode,
    applyPreset,
    play,
    pause,
    stop
  }
}
