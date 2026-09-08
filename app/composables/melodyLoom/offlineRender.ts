import type { MelodicInstrument, RowInstrument, SoundEffectId } from '~/composables/melodyLoom/types'
import { NOTE_FREQUENCIES, NOTES, STEPS, TOTAL_ROWS } from '~/composables/melodyLoom/types'
import { INSTRUMENTS, playMelodicNote, playSoundEffect } from '~/composables/melodyLoom/instruments'
import { createReverbBus } from '~/composables/melodyLoom/reverb'
import { cellKey, isNoteStart } from '~/composables/melodyLoom/sequencer'

// 2 extra seconds so a reverb tail from the last step isn't cut off mid-decay
// (matches the source app's recordSequenceToBuffer).
const REVERB_TAIL_SECONDS = 2

export interface SequenceRenderInput {
  grid: boolean[][]
  noteDurations: Map<string, number>
  rowInstruments: RowInstrument[]
  bpm: number
  volume: number
  reverbAmount: number
}

/**
 * Renders the full sequencer grid through an `OfflineAudioContext`, reusing
 * the exact same note-scheduling functions live playback uses (they all take
 * `BaseAudioContext`, see melodyLoom/instruments.ts and reverb.ts) so an
 * export or a "from sequencer" waveform import can never drift from what
 * pressing Play actually sounds like. Shared by #26 (WAV export) and #27
 * ("From Sequencer" into the waveform editor) — write scheduling changes once
 * here, not per caller.
 */
export async function renderSequenceToBuffer(input: SequenceRenderInput): Promise<AudioBuffer> {
  const stepSeconds = (60 / input.bpm) * 0.25
  const totalSeconds = STEPS * stepSeconds + REVERB_TAIL_SECONDS
  // 44.1kHz stereo regardless of the live context's rate — a fixed, portable
  // export format that doesn't depend on the device that rendered it.
  const sampleRate = 44100
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate)

  const bus = createReverbBus(offlineCtx, offlineCtx.destination)
  bus.setAmount(input.reverbAmount)

  for (let step = 0; step < STEPS; step++) {
    const startTime = step * stepSeconds

    for (let row = 0; row < TOTAL_ROWS; row++) {
      if (!isNoteStart(input.grid, input.noteDurations, row, step)) continue
      const instrument = input.rowInstruments[row]!

      if (row < NOTES) {
        const durationSteps = input.noteDurations.get(cellKey(row, step)) ?? 1
        playMelodicNote(
          offlineCtx,
          INSTRUMENTS[instrument as MelodicInstrument],
          NOTE_FREQUENCIES[row]!,
          startTime,
          durationSteps * stepSeconds,
          input.volume,
          bus.dryGain,
          bus.wetGain
        )
      } else {
        playSoundEffect(offlineCtx, instrument as SoundEffectId, startTime, input.volume, bus.dryGain, bus.wetGain)
      }
    }
  }

  return offlineCtx.startRendering()
}
