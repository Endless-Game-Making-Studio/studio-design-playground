import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'

/**
 * Decodes an imported file or a finished recording into an `AudioBuffer`.
 *
 * `decodeAudioData` detaches the `ArrayBuffer` it is handed, so the blob is
 * re-read per call rather than a buffer being kept around and reused.
 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer()
  return getSharedAudioContext().decodeAudioData(bytes)
}

/**
 * Lays `clip` over `base` starting at `atSeconds`, returning a new buffer —
 * it mixes rather than splices, so dropping a sound effect onto a melody
 * sounds against it instead of shoving the rest of the take later in time.
 *
 * The mix runs through an `OfflineAudioContext` rather than adding sample
 * arrays by hand because that is also what resamples a clip recorded or
 * rendered at a different rate to the take it's landing in.
 */
export async function mixBufferAt(base: AudioBuffer | null, clip: AudioBuffer, atSeconds: number): Promise<AudioBuffer> {
  const offset = Math.max(0, atSeconds)
  const sampleRate = base?.sampleRate ?? clip.sampleRate
  const channels = Math.max(base?.numberOfChannels ?? 1, clip.numberOfChannels)
  const seconds = Math.max(base?.duration ?? 0, offset + clip.duration)

  const ctx = new OfflineAudioContext(channels, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate)

  if (base) {
    const baseSource = ctx.createBufferSource()
    baseSource.buffer = base
    baseSource.connect(ctx.destination)
    baseSource.start(0)
  }

  const clipSource = ctx.createBufferSource()
  clipSource.buffer = clip
  clipSource.connect(ctx.destination)
  clipSource.start(offset)

  return ctx.startRendering()
}

/**
 * The MediaRecorder container this browser will actually give us. Safari has
 * no WebM encoder, and the blob has to be tagged with whatever was chosen or
 * `decodeAudioData` gets handed a file whose type lies about its contents.
 */
export function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const type of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  // Undefined lets the browser fall back to its own default rather than
  // failing the constructor outright on a container we guessed wrong.
  return undefined
}
