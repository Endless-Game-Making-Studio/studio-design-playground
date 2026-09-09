import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { ambienceSoundUrl, findAmbienceSound } from '~/composables/melodyLoom/ambienceLibrary'

/**
 * Decoded samples, keyed by URL. The promise is cached rather than the buffer
 * so a double-click on a clip that hasn't loaded yet waits on one fetch instead
 * of starting a second.
 */
const decoded = new Map<string, Promise<AudioBuffer>>()

// One preview at a time, page-wide: clicking through the grid should replace
// the sound you're hearing, not pile clips on top of each other.
let activePreview: AudioBufferSourceNode | null = null

function loadSample(url: string): Promise<AudioBuffer> {
  const cached = decoded.get(url)
  if (cached) return cached

  const pending = (async () => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Ambience sample missing: ${url}`)
    return getSharedAudioContext().decodeAudioData(await response.arrayBuffer())
  })()

  // A failed decode is dropped from the cache so a retry can fetch again.
  pending.catch(() => decoded.delete(url))
  decoded.set(url, pending)
  return pending
}

function sampleFor(soundId: string): Promise<AudioBuffer> {
  const sound = findAmbienceSound(soundId)
  if (!sound) throw new Error(`Unknown ambience sound: ${soundId}`)
  return loadSample(ambienceSoundUrl(sound))
}

export function stopAmbiencePreview() {
  if (!activePreview) return
  try {
    activePreview.stop()
  } catch {
    // Already ended on its own; there's nothing left to stop.
  }
  activePreview = null
}

/** Plays a clip once at `volume` (0–1), replacing whatever preview was sounding. */
export async function previewAmbienceSound(soundId: string, volume: number): Promise<void> {
  const buffer = await sampleFor(soundId)
  const ctx = getSharedAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()

  stopAmbiencePreview()

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(ctx.destination)
  source.onended = () => {
    if (activePreview === source) activePreview = null
  }
  source.start()
  activePreview = source
}

/**
 * The clip as an `AudioBuffer` at `volume`, ready to hand to the waveform
 * editor. At full volume the cached buffer is returned as-is — the editor mixes
 * it into a fresh buffer of its own, so there's nothing here to mutate.
 */
export async function renderAmbienceSound(soundId: string, volume: number): Promise<AudioBuffer> {
  const buffer = await sampleFor(soundId)
  if (volume === 1) return buffer

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(gain).connect(ctx.destination)
  source.start()
  return ctx.startRendering()
}
