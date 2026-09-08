// The grid's fixed shape: 24 melodic rows (a two-octave chromatic keyboard)
// stacked on 8 procedural sound-effect rows, 32 steps (a 16th-note bar) wide.
export const STEPS = 32
export const NOTES = 24
export const SOUND_EFFECTS = 8
export const TOTAL_ROWS = NOTES + SOUND_EFFECTS

// A note cycles through these on repeated clicks, then turns off. Effect rows
// track a duration too (same click behaviour), but always fire as one-shots.
export const DURATION_STEPS = [1, 2, 4, 8] as const
export type DurationSteps = typeof DURATION_STEPS[number]

export type MelodicInstrument =
  | 'synth'
  | 'bass'
  | 'guitar'
  | 'trumpet'
  | 'piano'
  | 'organ'
  | 'flute'
  | 'violin'
  | 'bell'
  | 'drum'
  | 'strings'
  | 'harpsichord'

export const MELODIC_INSTRUMENTS: MelodicInstrument[] = [
  'synth', 'bass', 'guitar', 'trumpet', 'piano', 'organ',
  'flute', 'violin', 'bell', 'drum', 'strings', 'harpsichord'
]

export type SoundEffectId =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'coin'
  | 'jump'
  | 'powerup'
  | 'laser'
  | 'explosion'

export const SOUND_EFFECT_IDS: SoundEffectId[] = [
  'kick', 'snare', 'hihat', 'coin', 'jump', 'powerup', 'laser', 'explosion'
]

// What a row is currently wired to play — a melodic instrument for the first
// 24 rows, an effect for the last 8. One flat array indexed by row rather than
// two separate ones, since presets and playback both address rows by index.
export type RowInstrument = MelodicInstrument | SoundEffectId

export interface InstrumentSettings {
  waveform: OscillatorType
  // Seconds, manually driven via gain automation (see melodyLoom/instruments.ts).
  attack: number
  decay: number
  // 0-1 level the envelope decays to before release.
  sustain: number
  release: number
  volume: number
  // A representative note length for this instrument outside the grid (not
  // used by sequencer playback, which always takes its duration from the
  // grid) — kept for later tickets that preview an instrument on its own.
  duration: number
  // Relative amplitude (0-1) of overtones above the fundamental. Harmonic at
  // array index `i` plays at `fundamental * (i + 2)` — the first entry is the
  // first overtone, not the fundamental itself — dry-routed only, flat gain.
  harmonics?: number[]
}

export type PresetPack = '8bit' | 'arcade' | 'chiptune' | 'retro' | 'custom'
export const PRESET_PACKS: Exclude<PresetPack, 'custom'>[] = ['8bit', 'arcade', 'chiptune', 'retro']

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

// C4..B5, row 0 = the highest note (B5) descending to row 23 = the lowest
// (C4) — the usual piano-roll convention of high pitches at the top.
export const NOTE_FREQUENCIES: number[] = Array.from({ length: NOTES }, (_, row) => midiToFrequency(83 - row))
