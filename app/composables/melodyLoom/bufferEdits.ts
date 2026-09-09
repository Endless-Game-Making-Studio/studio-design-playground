import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'

/**
 * A half-open span of samples, `[start, end)`. Sample indices rather than
 * seconds because every edit in here has to land on an exact frame — rounding
 * twice (once to place the cut, once to copy it) is how a splice ends up one
 * sample longer than the range it removed.
 */
export interface SampleRange {
  start: number
  end: number
}

/** One delayed, quieter copy of the source mixed back over it. */
export interface DelayTap {
  delaySeconds: number
  gain: number
}

function createBuffer(like: AudioBuffer, length: number): AudioBuffer {
  return getSharedAudioContext().createBuffer(like.numberOfChannels, Math.max(1, length), like.sampleRate)
}

/** Clamped to the buffer, so a selection left over from a longer take can't read past its end. */
export function sampleAt(buffer: AudioBuffer, seconds: number): number {
  return Math.max(0, Math.min(buffer.length, Math.round(seconds * buffer.sampleRate)))
}

// ─── Splices ──────────────────────────────────────────────────────────────
//
// These change the length of the take, which is what separates them from
// `mixBufferAt` in `audioBuffers.ts`: that lays a clip over what is already
// there and leaves the timeline alone.

/** The samples inside `range` as a buffer of their own — what Copy keeps. */
export function sliceRange(buffer: AudioBuffer, range: SampleRange): AudioBuffer | null {
  const length = range.end - range.start
  if (length <= 0) return null

  const slice = createBuffer(buffer, length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    slice.getChannelData(channel).set(buffer.getChannelData(channel).subarray(range.start, range.end))
  }
  return slice
}

/**
 * Removes `range` and closes the gap: the take gets shorter and everything
 * after the range moves earlier. Null when the whole take was removed.
 */
export function spliceOut(buffer: AudioBuffer, range: SampleRange): AudioBuffer | null {
  const removed = range.end - range.start
  if (removed <= 0) return buffer

  const length = buffer.length - removed
  if (length <= 0) return null

  const next = createBuffer(buffer, length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = next.getChannelData(channel)
    target.set(source.subarray(0, range.start), 0)
    target.set(source.subarray(range.end), range.start)
  }
  return next
}

/**
 * Opens a gap at `atSample` and drops `clip` into it: the take gets longer and
 * everything after the insertion point moves later.
 */
export function spliceIn(buffer: AudioBuffer, clip: AudioBuffer, atSample: number): AudioBuffer {
  const at = Math.max(0, Math.min(buffer.length, atSample))
  const next = createBuffer(buffer, buffer.length + clip.length)

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = next.getChannelData(channel)
    // A mono clip pasted into a stereo take repeats on both sides rather than
    // leaving one of them silent.
    const clipData = clip.getChannelData(Math.min(channel, clip.numberOfChannels - 1))

    target.set(source.subarray(0, at), 0)
    target.set(clipData, at)
    target.set(source.subarray(at), at + clip.length)
  }
  return next
}

// ─── Effects ──────────────────────────────────────────────────────────────

const clampSample = (value: number) => Math.max(-1, Math.min(1, value))

/** Copies the take and rewrites only the samples inside `range`. */
function mapRange(
  buffer: AudioBuffer,
  range: SampleRange,
  sampleAtOffset: (offset: number, sample: number) => number
): AudioBuffer {
  const next = createBuffer(buffer, buffer.length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = next.getChannelData(channel)
    target.set(source)
    for (let i = range.start; i < range.end; i++) target[i] = sampleAtOffset(i - range.start, source[i]!)
  }
  return next
}

function peakOf(buffer: AudioBuffer, range: SampleRange): number {
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = range.start; i < range.end; i++) peak = Math.max(peak, Math.abs(data[i]!))
  }
  return peak
}

/**
 * Lifts the range so its loudest sample sits at full scale. One scale factor
 * across every channel, so a stereo take keeps its image instead of having the
 * quieter side pulled up to meet the louder one.
 */
export function normalizeRange(buffer: AudioBuffer, range: SampleRange): AudioBuffer {
  const peak = peakOf(buffer, range)
  if (peak <= 0) return buffer
  const scale = 1 / peak
  return mapRange(buffer, range, (_, sample) => sample * scale)
}

export function scaleRange(buffer: AudioBuffer, range: SampleRange, factor: number): AudioBuffer {
  return mapRange(buffer, range, (_, sample) => clampSample(sample * factor))
}

/** A linear ramp across the whole range, up for `'in'` and down for `'out'`. */
export function fadeRange(buffer: AudioBuffer, range: SampleRange, direction: 'in' | 'out'): AudioBuffer {
  const length = range.end - range.start
  if (length <= 0) return buffer
  return mapRange(buffer, range, (offset, sample) => {
    const progress = offset / length
    return sample * (direction === 'in' ? progress : 1 - progress)
  })
}

/**
 * Mixes decaying copies of `range` back over the take. Only the part of a tail
 * that would run past the end lengthens the buffer, so a selection in the
 * middle echoes into what already follows it rather than shoving it later.
 */
export function applyDelayTaps(buffer: AudioBuffer, range: SampleRange, taps: DelayTap[]): AudioBuffer {
  const offsets = taps.map(tap => Math.round(tap.delaySeconds * buffer.sampleRate))
  const length = Math.max(buffer.length, range.end + Math.max(0, ...offsets))
  const next = createBuffer(buffer, length)

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = next.getChannelData(channel)
    target.set(source)

    for (let tap = 0; tap < taps.length; tap++) {
      const offset = offsets[tap]!
      const gain = taps[tap]!.gain
      for (let i = range.start; i < range.end; i++) {
        const at = i + offset
        if (at < length) target[at]! += source[i]! * gain
      }
    }

    // Taps land on top of whatever is already there, so the sum can run past
    // full scale. Pulling the whole channel back keeps the shape of the sound;
    // clamping each sample instead would flatten the peaks into distortion.
    let peak = 0
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(target[i]!))
    if (peak > 1) for (let i = 0; i < length; i++) target[i]! /= peak
  }
  return next
}

/** Three repeats, each half the level of the one before it. */
export const ECHO_TAPS: DelayTap[] = [1, 2, 3].map(repeat => ({
  delaySeconds: 0.3 * repeat,
  gain: 0.5 ** repeat
}))

/**
 * A small room, faked with six early reflections rather than a convolver. The
 * delays are deliberately not multiples of each other — evenly spaced taps
 * comb-filter into a metallic ring instead of a room.
 */
export const REVERB_TAPS: DelayTap[] = [
  { delaySeconds: 0.031, gain: 0.3 },
  { delaySeconds: 0.053, gain: 0.25 },
  { delaySeconds: 0.071, gain: 0.2 },
  { delaySeconds: 0.113, gain: 0.15 },
  { delaySeconds: 0.131, gain: 0.12 },
  { delaySeconds: 0.173, gain: 0.1 }
]

export interface PitchShiftResult {
  buffer: AudioBuffer
  /** Where the resampled audio ended up — it is a different length than the range it replaced. */
  range: SampleRange
}

/**
 * Resamples `range` by `2^(semitones/12)` and splices the result back in.
 * Speeding the tape up rather than shifting formants, so the stretch gets
 * shorter as it gets higher — the chipmunk sound this tool is after, and far
 * less machinery than a phase vocoder.
 */
export function pitchShiftRange(buffer: AudioBuffer, range: SampleRange, semitones: number): PitchShiftResult {
  const ratio = 2 ** (semitones / 12)
  const sourceLength = range.end - range.start
  if (sourceLength <= 0) return { buffer, range }

  const shiftedLength = Math.max(1, Math.round(sourceLength / ratio))
  const next = createBuffer(buffer, buffer.length - sourceLength + shiftedLength)

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel)
    const target = next.getChannelData(channel)
    target.set(source.subarray(0, range.start), 0)

    for (let i = 0; i < shiftedLength; i++) {
      // Interpolated between neighbours rather than snapped to the nearest
      // sample, which adds an audible buzz on top of the shift.
      const at = range.start + i * ratio
      const left = Math.min(Math.floor(at), range.end - 1)
      const right = Math.min(left + 1, range.end - 1)
      const fraction = at - left
      target[range.start + i] = source[left]! * (1 - fraction) + source[right]! * fraction
    }

    target.set(source.subarray(range.end), range.start + shiftedLength)
  }

  return { buffer: next, range: { start: range.start, end: range.start + shiftedLength } }
}
