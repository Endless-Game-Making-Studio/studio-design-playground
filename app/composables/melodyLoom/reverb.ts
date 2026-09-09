// A synthetic impulse response rather than a recorded one — no audio asset to
// ship, and a decaying-noise buffer reads as a plausible room/plate reverb for
// a chiptune tool. `BaseAudioContext` (not `AudioContext`) so the same
// function works against an `OfflineAudioContext` for the WAV export in #26.
export function createImpulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const durationSeconds = 1.5
  const length = Math.floor(ctx.sampleRate * durationSeconds)
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
    }
  }

  return impulse
}

export interface ReverbBus {
  dryGain: GainNode
  wetGain: GainNode
  setAmount: (amount: number) => void
}

/**
 * One shared convolver per playback context: every note/effect splits into a
 * dry path (straight to `dryGain`) and a wet path (through the convolver into
 * `wetGain`), both landing on `destination`. `setAmount` only has to touch the
 * wet gain — the split itself is wired once.
 */
export function createReverbBus(ctx: BaseAudioContext, destination: AudioNode): ReverbBus {
  const convolver = ctx.createConvolver()
  convolver.buffer = createImpulseResponse(ctx)

  const dryGain = ctx.createGain()
  const wetGain = ctx.createGain()
  dryGain.gain.value = 1
  wetGain.gain.value = 0

  dryGain.connect(destination)
  wetGain.connect(convolver)
  convolver.connect(destination)

  return {
    dryGain,
    wetGain,
    setAmount(amount: number) {
      wetGain.gain.value = amount
    }
  }
}
