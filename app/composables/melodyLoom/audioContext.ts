let sharedContext: AudioContext | null = null

// Lazy on purpose: `AudioContext` doesn't exist during SSR, so constructing it
// at module scope would throw the moment this file is imported on the server.
export function getSharedAudioContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext()
  return sharedContext
}

/**
 * iOS/Safari keep every AudioContext muted until a real user gesture touches
 * it. Installs one-time capture-phase `pointerdown`/`keydown` listeners on
 * `document` that resume the context and play a silent buffer (the standard
 * unlock trick), then remove themselves. Returns a disposer for early cleanup
 * (a page navigated away before any gesture fired).
 */
export function installAudioUnlock(ctx: AudioContext): () => void {
  let unlocked = false

  function unlock() {
    if (unlocked) return
    unlocked = true

    if (ctx.state === 'suspended') void ctx.resume()

    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    source.stop(0)

    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
  }

  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('keydown', unlock, true)

  return () => {
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
  }
}
