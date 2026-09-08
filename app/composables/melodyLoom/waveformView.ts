// The waveform's viewport maths, kept out of the composable so zoom, panning
// and time<->pixel conversion can be reasoned about (and reused by the
// canvas) without a Vue instance in the way.

// Zoom is "how many times over does the buffer overflow the canvas" — 1 fits
// the whole thing, 8 shows an eighth of it. 512 is where a 32-step bar is
// still readable at single-note resolution; past that the peaks are noise.
export const MIN_ZOOM = 1
export const MAX_ZOOM = 512

// Matches PatchWorkShop's canvas so a wheel notch feels the same across the
// two tools, rather than each picking its own sensitivity.
export const ZOOM_WHEEL_FACTOR = 0.0015

// Shift+wheel pans by a fraction of the *visible* window, so a notch moves
// the same apparent distance whether you're zoomed to a bar or to a note.
export const PAN_WHEEL_FRACTION = 0.0025

/** An absolute time range in seconds. Selections and the visible window share this shape. */
export interface TimeWindow {
  start: number
  end: number
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function visibleDuration(duration: number, zoom: number): number {
  return duration / clampZoom(zoom)
}

/** The furthest left edge that still fills the canvas — panning stops here rather than running off the end. */
export function maxPan(duration: number, zoom: number): number {
  return Math.max(0, duration - visibleDuration(duration, zoom))
}

export function clampPan(duration: number, zoom: number, pan: number): number {
  if (!Number.isFinite(pan)) return 0
  return Math.min(maxPan(duration, zoom), Math.max(0, pan))
}

export function timeWindow(duration: number, zoom: number, pan: number): TimeWindow {
  const start = clampPan(duration, zoom, pan)
  return { start, end: start + visibleDuration(duration, zoom) }
}

export function timeToX(seconds: number, window: TimeWindow, width: number): number {
  const span = window.end - window.start
  if (span <= 0) return 0
  return ((seconds - window.start) / span) * width
}

export function xToTime(x: number, window: TimeWindow, width: number): number {
  if (width <= 0) return window.start
  return window.start + (x / width) * (window.end - window.start)
}

/**
 * Zooming by `factor` while holding `anchorSeconds` under the same pixel it
 * was already under — zooming to the middle of the window instead makes
 * people chase the part of the take they were looking at.
 */
export function zoomAroundTime(
  duration: number,
  zoom: number,
  pan: number,
  anchorSeconds: number,
  factor: number
): { zoom: number, pan: number } {
  const nextZoom = clampZoom(zoom * factor)
  if (duration <= 0) return { zoom: nextZoom, pan: 0 }

  const current = timeWindow(duration, zoom, pan)
  const span = current.end - current.start
  const ratio = span > 0 ? (anchorSeconds - current.start) / span : 0
  const nextStart = anchorSeconds - ratio * visibleDuration(duration, nextZoom)

  return { zoom: nextZoom, pan: clampPan(duration, nextZoom, nextStart) }
}

/** One min/max pair per canvas column — the classic envelope, not a resampled signal. */
export interface Peak {
  min: number
  max: number
}

// A full scan of a long take costs a few million reads, and a wheel gesture
// redraws on every notch, so wide columns get sampled rather than read whole.
// The envelope of 512 evenly spread samples is visually identical at this size.
const MAX_SAMPLES_PER_COLUMN = 512

/**
 * Reduces the visible slice of `buffer` to one min/max pair per column,
 * across every channel at once — a stereo take draws as a single envelope
 * here, which is what the block is for (seeing where the sound is), not
 * per-channel metering.
 *
 * Both ends of every pair are seeded at 0 so the envelope always straddles
 * the centre line instead of floating away from it in near-silent stretches.
 */
export function computePeaks(buffer: AudioBuffer, window: TimeWindow, columns: number): Peak[] {
  const peaks: Peak[] = []
  if (columns <= 0) return peaks

  const startSample = Math.max(0, Math.floor(window.start * buffer.sampleRate))
  const endSample = Math.min(buffer.length, Math.ceil(window.end * buffer.sampleRate))
  const samplesPerColumn = (endSample - startSample) / columns

  const channels: Float32Array[] = []
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channels.push(buffer.getChannelData(channel))
  }

  for (let column = 0; column < columns; column++) {
    const from = startSample + Math.floor(column * samplesPerColumn)
    const to = Math.min(endSample, from + Math.max(1, Math.ceil(samplesPerColumn)))
    const stride = Math.max(1, Math.ceil((to - from) / MAX_SAMPLES_PER_COLUMN))

    let min = 0
    let max = 0
    for (const data of channels) {
      for (let i = from; i < to; i += stride) {
        const value = data[i]!
        if (value < min) min = value
        if (value > max) max = value
      }
    }
    peaks.push({ min, max })
  }

  return peaks
}

/**
 * The spacing of the time ruler's labels, chosen so a window always carries
 * roughly a handful of them rather than one or a hundred.
 */
export function tickInterval(spanSeconds: number): number {
  if (spanSeconds <= 0) return 1
  if (spanSeconds < 0.5) return 0.05
  if (spanSeconds < 2) return 0.1
  if (spanSeconds < 10) return 0.5
  if (spanSeconds < 60) return 5
  return 10
}
