import type { SequenceRenderInput } from '~/composables/melodyLoom/offlineRender'
import type { TimeWindow } from '~/composables/melodyLoom/waveformView'
import { renderSequenceToBuffer } from '~/composables/melodyLoom/offlineRender'
import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { decodeAudioBlob, mixBufferAt, pickRecordingMimeType } from '~/composables/melodyLoom/audioBuffers'
import { MIN_ZOOM, clampPan, clampZoom, maxPan, timeWindow, zoomAroundTime } from '~/composables/melodyLoom/waveformView'
import { pickFile } from '~/composables/files'

/**
 * Failures the block has to own up to, as codes rather than sentences — the
 * component turns them into copy so nothing in here has to know about i18n.
 */
export type WaveformErrorCode =
  | 'micDenied'
  | 'micNotFound'
  | 'micUnavailable'
  | 'recordFailed'
  | 'decodeFailed'
  | 'renderFailed'

export interface TimeSelection {
  start: number
  end: number
}

function recordingErrorCode(error: unknown): WaveformErrorCode {
  if (!(error instanceof DOMException)) return 'recordFailed'
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'micDenied'
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'micNotFound'
  return 'recordFailed'
}

/**
 * Melody Loom's waveform block: one audio buffer, how it's being looked at,
 * and every way of getting sound into it (import, the sequencer, the
 * microphone) or hearing it back.
 *
 * One instance per page, provided via `useWaveformEditorContext`, the same way
 * the sequencer half of the tool is shared.
 */
export function useWaveformEditor() {
  // Shallow on purpose: an AudioBuffer is opaque to Vue's reactivity and huge
  // — only swapping the whole thing should ever count as a change.
  const buffer = shallowRef<AudioBuffer | null>(null)
  const duration = computed(() => buffer.value?.duration ?? 0)

  // Selection and cursor are deliberately separate state, not two readings of
  // one playhead — a toolbar acting on a range (#28's cut/copy/paste) and a
  // point to drop a clip at (#29) are different questions.
  const selection = ref<TimeSelection | null>(null)
  const cursor = ref(0)

  const zoom = ref(MIN_ZOOM)
  const pan = ref(0)
  const view = computed<TimeWindow>(() => timeWindow(duration.value, zoom.value, pan.value))
  const isZoomed = computed(() => zoom.value > MIN_ZOOM)
  const panLimit = computed(() => maxPan(duration.value, zoom.value))

  const isPlaying = ref(false)
  const playhead = ref(0)
  const isRecording = ref(false)
  const recordingSeconds = ref(0)
  const isBusy = ref(false)
  const error = ref<WaveformErrorCode | null>(null)

  function dismissError() {
    error.value = null
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  let source: AudioBufferSourceNode | null = null
  let frame = 0
  let startedAt = 0
  let playFrom = 0

  function stop() {
    if (source) {
      // Cleared first so the node's own end event doesn't re-enter this.
      source.onended = null
      try {
        source.stop()
      } catch {
        // Already finished; nothing to stop.
      }
      source.disconnect()
      source = null
    }
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    isPlaying.value = false
    playhead.value = playFrom
  }

  /** Plays the selection when there is one, otherwise the take from the cursor to its end. */
  function play() {
    const current = buffer.value
    if (!current || isPlaying.value) return

    const from = selection.value
      ? Math.max(0, Math.min(selection.value.start, current.duration))
      : (cursor.value < current.duration ? cursor.value : 0)
    const to = selection.value
      ? Math.max(0, Math.min(selection.value.end, current.duration))
      : current.duration
    if (to - from <= 0) return

    const ctx = getSharedAudioContext()
    if (ctx.state === 'suspended') void ctx.resume()

    source = ctx.createBufferSource()
    source.buffer = current
    source.connect(ctx.destination)
    source.onended = stop
    source.start(0, from, to - from)

    startedAt = ctx.currentTime
    playFrom = from
    playhead.value = from
    isPlaying.value = true

    // The audio clock, not a wall clock — a dropped frame then shows up as a
    // playhead that catches up rather than one that drifts off the sound.
    const step = () => {
      if (!source) return
      playhead.value = Math.min(to, playFrom + (getSharedAudioContext().currentTime - startedAt))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  }

  function togglePlayback() {
    if (isPlaying.value) stop()
    else play()
  }

  // ─── The buffer ───────────────────────────────────────────────────────────

  /**
   * The one way the audio is ever replaced. Import, recording, "from
   * sequencer" and #28's edits all land here, so undo history only has to
   * wrap this rather than every caller.
   *
   * The view is clamped rather than reset, so an edit applied at a zoom level
   * leaves you looking at the same stretch of the take.
   */
  function setBuffer(next: AudioBuffer | null) {
    stop()
    buffer.value = next

    const seconds = next?.duration ?? 0
    playFrom = 0
    cursor.value = Math.min(cursor.value, seconds)
    playhead.value = cursor.value
    selection.value = selection.value && selection.value.end <= seconds ? selection.value : null
    zoom.value = clampZoom(zoom.value)
    pan.value = clampPan(seconds, zoom.value, pan.value)
  }

  /** A fresh take, as opposed to an edit of the current one — start of the buffer, whole thing in view. */
  function loadBuffer(next: AudioBuffer) {
    setBuffer(next)
    resetView()
    cursor.value = 0
    playhead.value = 0
    selection.value = null
  }

  /**
   * Mixes a rendered clip into the take at `atSeconds`, leaving whatever is
   * already there in place — this is how #29's sound library drops an effect
   * in at the playhead.
   */
  async function insertBufferAt(clip: AudioBuffer, atSeconds: number) {
    isBusy.value = true
    try {
      setBuffer(await mixBufferAt(buffer.value, clip, atSeconds))
    } finally {
      isBusy.value = false
    }
  }

  async function importFile() {
    const file = await pickFile('audio/*')
    if (!file) return

    isBusy.value = true
    error.value = null
    try {
      loadBuffer(await decodeAudioBlob(file))
    } catch {
      error.value = 'decodeFailed'
    } finally {
      isBusy.value = false
    }
  }

  /**
   * Takes the render input rather than reading the sequencer itself, so this
   * composable stays independent of the grid half of the tool.
   */
  async function loadFromSequence(input: SequenceRenderInput) {
    isBusy.value = true
    error.value = null
    try {
      loadBuffer(await renderSequenceToBuffer(input))
    } catch {
      error.value = 'renderFailed'
    } finally {
      isBusy.value = false
    }
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  let recorder: MediaRecorder | null = null
  let recorderStream: MediaStream | null = null
  let chunks: Blob[] = []
  let discarded = false
  let recordingTimer: ReturnType<typeof setInterval> | null = null

  function releaseRecorder() {
    if (recordingTimer) clearInterval(recordingTimer)
    recordingTimer = null
    // Stopping the tracks is what turns the browser's recording indicator
    // off — leaving the stream open keeps the microphone hot.
    recorderStream?.getTracks().forEach(track => track.stop())
    recorderStream = null
    recorder = null
    chunks = []
    isRecording.value = false
    recordingSeconds.value = 0
  }

  async function startRecording() {
    if (isRecording.value) return
    error.value = null

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      error.value = 'micUnavailable'
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
    } catch (cause) {
      error.value = recordingErrorCode(cause)
      return
    }

    stop()
    discarded = false
    chunks = []
    recorderStream = stream

    const mimeType = pickRecordingMimeType()
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      error.value = 'recordFailed'
      releaseRecorder()
      return
    }

    recorder.ondataavailable = (event) => {
      // A cancelled take never accumulates anything to decode in the first
      // place, rather than being decoded and then thrown away.
      if (discarded || event.data.size === 0) return
      chunks.push(event.data)
    }

    recorder.onstop = async () => {
      const captured = chunks
      const type = recorder?.mimeType || mimeType || 'audio/webm'
      releaseRecorder()
      if (discarded || captured.length === 0) return

      isBusy.value = true
      try {
        loadBuffer(await decodeAudioBlob(new Blob(captured, { type })))
      } catch {
        error.value = 'decodeFailed'
      } finally {
        isBusy.value = false
      }
    }

    recorder.start(100)
    isRecording.value = true
    recordingSeconds.value = 0

    const startedRecordingAt = Date.now()
    recordingTimer = setInterval(() => {
      recordingSeconds.value = (Date.now() - startedRecordingAt) / 1000
    }, 100)
  }

  function stopRecording() {
    if (!recorder || recorder.state === 'inactive') return releaseRecorder()
    recorder.stop()
  }

  function cancelRecording() {
    discarded = true
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else releaseRecorder()
  }

  // ─── Selection, cursor and view ───────────────────────────────────────────

  function setCursor(seconds: number) {
    cursor.value = Math.max(0, Math.min(duration.value, seconds))
    if (!isPlaying.value) playhead.value = cursor.value
    playFrom = cursor.value
  }

  /** Always stored low-to-high, so a right-to-left drag reads the same as a left-to-right one. */
  function setSelection(range: TimeSelection | null) {
    if (!range) return clearSelection()
    const start = Math.max(0, Math.min(duration.value, Math.min(range.start, range.end)))
    const end = Math.max(0, Math.min(duration.value, Math.max(range.start, range.end)))
    selection.value = end > start ? { start, end } : null
  }

  function clearSelection() {
    selection.value = null
  }

  function selectAll() {
    if (duration.value <= 0) return
    selection.value = { start: 0, end: duration.value }
  }

  function zoomAt(anchorSeconds: number, factor: number) {
    const next = zoomAroundTime(duration.value, zoom.value, pan.value, anchorSeconds, factor)
    zoom.value = next.zoom
    pan.value = next.pan
  }

  function setPan(seconds: number) {
    pan.value = clampPan(duration.value, zoom.value, seconds)
  }

  function panBy(seconds: number) {
    setPan(pan.value + seconds)
  }

  function resetView() {
    zoom.value = MIN_ZOOM
    pan.value = 0
  }

  onBeforeUnmount(() => {
    stop()
    cancelRecording()
  })

  return {
    buffer,
    duration,
    selection,
    cursor,
    playhead,
    zoom,
    pan,
    view,
    isZoomed,
    panLimit,
    isPlaying,
    isRecording,
    recordingSeconds,
    isBusy,
    error,
    dismissError,
    setBuffer,
    insertBufferAt,
    importFile,
    loadFromSequence,
    play,
    stop,
    togglePlayback,
    startRecording,
    stopRecording,
    cancelRecording,
    setCursor,
    setSelection,
    clearSelection,
    selectAll,
    zoomAt,
    setPan,
    panBy,
    resetView
  }
}
