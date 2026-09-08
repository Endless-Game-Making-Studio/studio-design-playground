// Uncompressed 16-bit PCM WAV — no encoder library to ship, and every export
// in Melody Loom (#26's sequencer render, #28's edited waveform buffer) only
// ever needs a file a learner can drop straight into a game engine.
export function encodeWav(buffer: AudioBuffer): Blob {
  const bytesPerSample = 2
  const blockAlign = buffer.numberOfChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(arrayBuffer)

  let pos = 0
  const writeUint16 = (value: number) => {
    view.setUint16(pos, value, true)
    pos += 2
  }
  const writeUint32 = (value: number) => {
    view.setUint32(pos, value, true)
    pos += 4
  }
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(pos++, value.charCodeAt(i))
  }

  writeString('RIFF')
  writeUint32(36 + dataLength)
  writeString('WAVE')

  writeString('fmt ')
  writeUint32(16) // PCM format chunk size
  writeUint16(1) // PCM
  writeUint16(buffer.numberOfChannels)
  writeUint32(buffer.sampleRate)
  writeUint32(buffer.sampleRate * blockAlign) // byte rate
  writeUint16(blockAlign)
  writeUint16(bytesPerSample * 8) // bits per sample

  writeString('data')
  writeUint32(dataLength)

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
  for (let frame = 0; frame < buffer.length; frame++) {
    for (const channel of channels) {
      const clamped = Math.max(-1, Math.min(1, channel[frame]!))
      view.setInt16(pos, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      pos += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
