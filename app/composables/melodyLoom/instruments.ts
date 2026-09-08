import type { InstrumentSettings, MelodicInstrument, PresetPack, SoundEffectId } from '~/composables/melodyLoom/types'
import { NOTES } from '~/composables/melodyLoom/types'

// ─── Melodic instruments ─────────────────────────────────────────────────────
// 12 hand-tuned chiptune-ish timbres. Creative latitude taken on exact
// ADSR/waveform numbers — the goal is 12 audibly distinct, pleasant voices,
// not byte-for-byte parity with the source app.
export const INSTRUMENTS: Record<MelodicInstrument, InstrumentSettings> = {
  synth: { waveform: 'square', attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.12, volume: 0.5, duration: 0.3 },
  bass: { waveform: 'sine', attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.15, volume: 0.6, duration: 0.4 },
  guitar: { waveform: 'sawtooth', attack: 0.004, decay: 0.15, sustain: 0.35, release: 0.2, volume: 0.4, duration: 0.35, harmonics: [0.5, 0.25] },
  trumpet: { waveform: 'sawtooth', attack: 0.03, decay: 0.05, sustain: 0.75, release: 0.1, volume: 0.4, duration: 0.35 },
  piano: { waveform: 'triangle', attack: 0.002, decay: 0.3, sustain: 0.25, release: 0.3, volume: 0.5, duration: 0.5, harmonics: [0.3, 0.15, 0.08] },
  organ: { waveform: 'sine', attack: 0.01, decay: 0.02, sustain: 0.9, release: 0.08, volume: 0.4, duration: 0.4, harmonics: [0.5, 0.33, 0.25] },
  flute: { waveform: 'sine', attack: 0.08, decay: 0.05, sustain: 0.8, release: 0.15, volume: 0.35, duration: 0.4, harmonics: [0.15] },
  violin: { waveform: 'sawtooth', attack: 0.1, decay: 0.05, sustain: 0.85, release: 0.2, volume: 0.35, duration: 0.4 },
  bell: { waveform: 'sine', attack: 0.002, decay: 0.6, sustain: 0.05, release: 0.8, volume: 0.4, duration: 0.8, harmonics: [0.6, 0.3, 0.15] },
  drum: { waveform: 'triangle', attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.08, volume: 0.55, duration: 0.15 },
  strings: { waveform: 'sawtooth', attack: 0.15, decay: 0.1, sustain: 0.75, release: 0.3, volume: 0.3, duration: 0.5, harmonics: [0.2, 0.1] },
  harpsichord: { waveform: 'square', attack: 0.001, decay: 0.25, sustain: 0.15, release: 0.15, volume: 0.35, duration: 0.3, harmonics: [0.4, 0.2] }
}

/**
 * One fundamental oscillator (manually driven ADSR via gain automation) plus
 * one extra oscillator per harmonic, split dry/wet through `dryGain`/`wetGain`
 * (the harmonics are dry-only, flat gain — no reverb send). Guards against the
 * two Web Audio footguns a fast BPM + a short tied-off note can hit: an
 * exponential ramp to exact 0 (illegal — the release ramps linearly to 0
 * instead), and a release scheduled before attack/decay finished (the
 * sustain-to-release point is clamped to never precede it).
 */
export function playMelodicNote(
  ctx: BaseAudioContext,
  settings: InstrumentSettings,
  frequency: number,
  startTime: number,
  durationSeconds: number,
  masterVolume: number,
  dryGain: AudioNode,
  wetGain: AudioNode
): void {
  const peak = settings.volume * masterVolume
  const safeRelease = Math.min(settings.release, durationSeconds * 0.5)
  const sustainStart = Math.max(startTime + settings.attack + settings.decay, startTime + durationSeconds - safeRelease)
  const endTime = sustainStart + safeRelease

  const osc = ctx.createOscillator()
  osc.type = settings.waveform
  osc.frequency.setValueAtTime(frequency, startTime)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peak, startTime + settings.attack)
  gain.gain.linearRampToValueAtTime(peak * settings.sustain, startTime + settings.attack + settings.decay)
  gain.gain.setValueAtTime(peak * settings.sustain, sustainStart)
  gain.gain.linearRampToValueAtTime(0, endTime)

  osc.connect(gain)
  gain.connect(dryGain)
  gain.connect(wetGain)
  osc.start(startTime)
  osc.stop(endTime + 0.02)

  settings.harmonics?.forEach((amplitude, index) => {
    const harmonicOsc = ctx.createOscillator()
    harmonicOsc.type = settings.waveform
    // Harmonic at array index `i` is the (i+2)th partial — the first entry is
    // the first overtone above the fundamental, not the fundamental again.
    harmonicOsc.frequency.setValueAtTime(frequency * (index + 2), startTime)

    const level = peak * amplitude * 0.3
    const harmonicGain = ctx.createGain()
    harmonicGain.gain.setValueAtTime(0, startTime)
    harmonicGain.gain.linearRampToValueAtTime(level, startTime + Math.min(settings.attack, 0.01))
    harmonicGain.gain.setValueAtTime(level, Math.max(startTime, endTime - 0.02))
    harmonicGain.gain.linearRampToValueAtTime(0, endTime)

    harmonicOsc.connect(harmonicGain)
    harmonicGain.connect(dryGain)
    harmonicOsc.start(startTime)
    harmonicOsc.stop(endTime + 0.02)
  })
}

// ─── Procedural sound effects ────────────────────────────────────────────────

function createNoiseBuffer(ctx: BaseAudioContext, durationSeconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * durationSeconds)), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/**
 * One function for all 8 effects, parametrized over `BaseAudioContext` so the
 * same code drives live playback now and an `OfflineAudioContext` render in
 * #26 — the source app had this synthesis copy-pasted three times, which is
 * exactly what this avoids.
 */
export function playSoundEffect(
  ctx: BaseAudioContext,
  effect: SoundEffectId,
  startTime: number,
  masterVolume: number,
  dryGain: AudioNode,
  wetGain: AudioNode
): void {
  const connect = (node: AudioNode) => {
    node.connect(dryGain)
    node.connect(wetGain)
  }

  switch (effect) {
    case 'kick': {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(150, startTime)
      osc.frequency.exponentialRampToValueAtTime(50, startTime + 0.15)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.9, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2)
      osc.connect(gain)
      connect(gain)
      osc.start(startTime)
      osc.stop(startTime + 0.22)
      break
    }
    case 'snare': {
      const source = ctx.createBufferSource()
      source.buffer = createNoiseBuffer(ctx, 0.2)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.6, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)
      source.connect(gain)
      connect(gain)
      source.start(startTime)
      source.stop(startTime + 0.2)
      break
    }
    case 'hihat': {
      const source = ctx.createBufferSource()
      source.buffer = createNoiseBuffer(ctx, 0.08)
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 7000
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.4, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06)
      source.connect(filter)
      filter.connect(gain)
      connect(gain)
      source.start(startTime)
      source.stop(startTime + 0.08)
      break
    }
    case 'explosion': {
      const source = ctx.createBufferSource()
      source.buffer = createNoiseBuffer(ctx, 0.8)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.7, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7)
      source.connect(filter)
      filter.connect(gain)
      connect(gain)
      source.start(startTime)
      source.stop(startTime + 0.8)
      break
    }
    case 'coin': {
      // Two short detuned blips with a quick upward step, the classic pickup sound.
      [988, 1319].forEach((frequency, i) => {
        const blipTime = startTime + i * 0.07
        const osc = ctx.createOscillator()
        osc.type = 'square'
        osc.frequency.setValueAtTime(frequency, blipTime)
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(masterVolume * 0.3, blipTime)
        gain.gain.exponentialRampToValueAtTime(0.001, blipTime + 0.1)
        osc.connect(gain)
        connect(gain)
        osc.start(blipTime)
        osc.stop(blipTime + 0.12)
      })
      break
    }
    case 'jump': {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(300, startTime)
      osc.frequency.exponentialRampToValueAtTime(700, startTime + 0.12)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.35, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)
      osc.connect(gain)
      connect(gain)
      osc.start(startTime)
      osc.stop(startTime + 0.16)
      break
    }
    case 'powerup': {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(200, startTime)
      osc.frequency.exponentialRampToValueAtTime(1200, startTime + 0.3)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.32)
      osc.connect(gain)
      connect(gain)
      osc.start(startTime)
      osc.stop(startTime + 0.34)
      break
    }
    case 'laser': {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1800, startTime)
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.25)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(masterVolume * 0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25)
      osc.connect(gain)
      connect(gain)
      osc.start(startTime)
      osc.stop(startTime + 0.27)
      break
    }
  }
}

// ─── Presets ──────────────────────────────────────────────────────────────

// Splits the 24 melodic rows evenly across a small band list, high pitches
// (row 0) down to low (row 23) — a lead voice up top, bass at the bottom,
// like reading a score.
function expandBands(bands: MelodicInstrument[]): MelodicInstrument[] {
  const perBand = Math.ceil(NOTES / bands.length)
  return Array.from({ length: NOTES }, (_, row) => bands[Math.min(bands.length - 1, Math.floor(row / perBand))]!)
}

export interface PresetDefinition {
  melodic: MelodicInstrument[]
  effects: SoundEffectId[]
}

export const PRESETS: Record<Exclude<PresetPack, 'custom'>, PresetDefinition> = {
  '8bit': {
    melodic: expandBands(['synth', 'organ', 'guitar', 'bass']),
    effects: ['kick', 'hihat', 'snare', 'coin', 'jump', 'powerup', 'laser', 'explosion']
  },
  arcade: {
    melodic: expandBands(['trumpet', 'violin', 'harpsichord', 'drum']),
    effects: ['laser', 'coin', 'powerup', 'jump', 'kick', 'snare', 'hihat', 'explosion']
  },
  chiptune: {
    melodic: expandBands(['flute', 'piano', 'strings', 'harpsichord']),
    effects: ['coin', 'powerup', 'jump', 'hihat', 'kick', 'snare', 'laser', 'explosion']
  },
  retro: {
    melodic: expandBands(['organ', 'trumpet', 'strings', 'drum']),
    effects: ['snare', 'kick', 'hihat', 'explosion', 'laser', 'coin', 'jump', 'powerup']
  }
}
