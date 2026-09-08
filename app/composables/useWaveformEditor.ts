import type { SequenceRenderInput } from '~/composables/melodyLoom/offlineRender'
import type { SampleRange } from '~/composables/melodyLoom/bufferEdits'
import type { TimeWindow } from '~/composables/melodyLoom/waveformView'
import { renderSequenceToBuffer } from '~/composables/melodyLoom/offlineRender'
import { getSharedAudioContext } from '~/composables/melodyLoom/audioContext'
import { decodeAudioBlob, mixBufferAt, pickRecordingMimeType } from '~/composables/melodyLoom/audioBuffers'
import {
  ECHO_TAPS,
  REVERB_TAPS,
  applyDelayTaps,
  fadeRange,
  normalizeRange,
  pitchShiftRange,
  sampleAt,
  scaleRange,
  sliceRange,
  spliceIn,
  spliceOut
} from '~/composables/melodyLoom/bufferEdits'
import { encodeWav } from '~/composables/melodyLoom/wavEncoder'
import { MIN_ZOOM, clampPan, clampZoom, maxPan, timeWindow, zoomAroundTime } from '~/composables/melodyLoom/waveformView'
import { downloadBlob, pickFile } from '~/composables/files'

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

/** The one-click effects the toolbar menu offers, in the order it lists them. */
export type WaveformEffect = 'normalize' | 'amplify' | 'reduce' | 'fadeIn' | 'fadeOut' | 'echo' | 'reverb'

export const WAVEFORM_EFFECTS: WaveformEffect[] = [
  'normalize',
  'amplify',
  'reduce',
  'fadeIn',
  'fadeOut',
  'echo',
  'reverb'
]

/** Fading needs two edges to ramp between, so these are the ones the menu greys out without a selection. */
export const SELECTION_ONLY_EFFECTS: WaveformEffect[] = ['fadeIn', 'fadeOut']

const AMPLIFY_FACTOR = 1.5
const REDUCE_FACTOR = 0.6

// Undo snapshots are whole buffers, so what caps the history is memory rather
// than taste — a minute of 48 kHz stereo is about 23 MB per entry.
const HISTORY_LIMIT = 25

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
    resetHistory(next)
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
      commitEdit(await mixBufferAt(buffer.value, clip, atSeconds))
    } finally {
      isBusy.value = false
    }
  }

  // ─── Undo history ─────────────────────────────────────────────────────────

  // Null is a real state here: deleting everything empties the block, and that
  // has to be undoable like any other edit.
  const history = shallowRef<(AudioBuffer | null)[]>([])
  const historyIndex = ref(-1)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  /**
   * A take that arrives whole — imported, recorded, rendered from the grid —
   * starts its own history. It replaced what was there rather than editing it,
   * so there is nothing behind it worth stepping back to.
   */
  function resetHistory(next: AudioBuffer | null) {
    history.value = [next]
    historyIndex.value = 0
  }

  /** Every edit lands here: swap the buffer, record it, and drop any redo branch. */
  function commitEdit(next: AudioBuffer | null) {
    setBuffer(next)

    const kept = history.value.slice(0, historyIndex.value + 1)
    kept.push(next)
    history.value = kept.slice(-HISTORY_LIMIT)
    historyIndex.value = history.value.length - 1
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value -= 1
    setBuffer(history.value[historyIndex.value] ?? null)
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value += 1
    setBuffer(history.value[historyIndex.value] ?? null)
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

  // ─── Clipboard ────────────────────────────────────────────────────────────

  // The block's own clipboard rather than the system one: `navigator.clipboard`
  // carries text and images, not a stretch of decoded audio.
  const clipboard = shallowRef<AudioBuffer | null>(null)
  const hasClipboard = computed(() => clipboard.value !== null)
  const hasSelection = computed(() => selection.value !== null)

  /** The selection in samples, or the whole take when nothing is selected. */
  function editRange(current: AudioBuffer): SampleRange {
    const range = selection.value
    if (!range) return { start: 0, end: current.length }
    return { start: sampleAt(current, range.start), end: sampleAt(current, range.end) }
  }

  function copySelection() {
    const current = buffer.value
    if (!current || !selection.value) return
    clipboard.value = sliceRange(current, editRange(current))
  }

  /** Removes the selection and closes the gap — the take gets shorter. */
  function deleteSelection() {
    const current = buffer.value
    if (!current || !selection.value) return

    const range = editRange(current)
    const seam = range.start / current.sampleRate
    commitEdit(spliceOut(current, range))
    clearSelection()
    setCursor(seam)
  }

  function cutSelection() {
    copySelection()
    deleteSelection()
  }

  /**
   * Splices the clipboard in at the cursor, pushing everything after it later —
   * `insertBufferAt` is the other half of this pair, mixing a clip over the
   * take without moving anything.
   */
  function pasteClipboard() {
    const clip = clipboard.value
    if (!clip) return

    const current = buffer.value
    if (!current) return commitEdit(clip)

    const at = sampleAt(current, cursor.value)
    commitEdit(spliceIn(current, clip, at))
    clearSelection()
    // Parked past what was just pasted, so pasting twice lays the second copy
    // after the first rather than inside it.
    setCursor((at + clip.length) / current.sampleRate)
  }

  // ─── Effects ──────────────────────────────────────────────────────────────

  const EFFECTS: Record<WaveformEffect, (current: AudioBuffer, range: SampleRange) => AudioBuffer> = {
    normalize: normalizeRange,
    amplify: (current, range) => scaleRange(current, range, AMPLIFY_FACTOR),
    reduce: (current, range) => scaleRange(current, range, REDUCE_FACTOR),
    fadeIn: (current, range) => fadeRange(current, range, 'in'),
    fadeOut: (current, range) => fadeRange(current, range, 'out'),
    echo: (current, range) => applyDelayTaps(current, range, ECHO_TAPS),
    reverb: (current, range) => applyDelayTaps(current, range, REVERB_TAPS)
  }

  function applyEffect(effect: WaveformEffect) {
    const current = buffer.value
    if (!current) return
    if (!selection.value && SELECTION_ONLY_EFFECTS.includes(effect)) return
    commitEdit(EFFECTS[effect](current, editRange(current)))
  }

  /** Resamples the selection, or the whole take, by `semitones` — its length changes with its pitch. */
  function applyPitchShift(semitones: number) {
    const current = buffer.value
    if (!current || semitones === 0) return

    const shifted = pitchShiftRange(current, editRange(current), semitones)
    commitEdit(shifted.buffer)
    // The stretch is a different length now, so the selection follows it rather
    // than being left pointing at whatever moved in behind it.
    if (selection.value) {
      setSelection({
        start: shifted.range.start / current.sampleRate,
        end: shifted.range.end / current.sampleRate
      })
    }
  }

  /** `percent` is the slider's own 0–200 scale, where 100 leaves the level alone. */
  function applyVolume(percent: number) {
    const current = buffer.value
    if (!current || percent === 100) return
    commitEdit(scaleRange(current, editRange(current), percent / 100))
  }

  /** The take as it stands, edits and all — not a re-render of the sequencer grid. */
  function exportWav(fileName = 'melody-loom-waveform.wav') {
    if (!buffer.value) return
    downloadBlob(encodeWav(buffer.value), fileName)
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
    hasSelection,
    hasClipboard,
    canUndo,
    canRedo,
    dismissError,
    setBuffer,
    insertBufferAt,
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteClipboard,
    deleteSelection,
    applyEffect,
    applyPitchShift,
    applyVolume,
    exportWav,
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
