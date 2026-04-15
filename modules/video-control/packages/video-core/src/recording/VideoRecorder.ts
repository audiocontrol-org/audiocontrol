import type {
  VideoFormat,
  VideoRecorderConfig,
  VideoRecorderState,
  VideoRecorderEventType,
  VideoRecorderEventMap,
} from '../types'
import { VIDEO_FORMATS } from '../types'

type EventCallback<T extends VideoRecorderEventType> = (
  data: VideoRecorderEventMap[T]
) => void

const DEFAULT_FRAME_RATE = 24 // Film cadence
const DEFAULT_VIDEO_BITRATE = 8_000_000 // 8 Mbps

/**
 * VideoRecorder handles canvas capture and video export using MediaRecorder API.
 * Supports multiple aspect ratios and merges audio with video.
 */
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private recordingCanvas: HTMLCanvasElement
  private recordingContext: CanvasRenderingContext2D

  private _isRecording = false
  private _format: VideoFormat = 'youtube'
  private _startTime = 0
  private timerInterval: ReturnType<typeof setInterval> | null = null

  private frameRate: number
  private videoBitsPerSecond: number

  private listeners: Map<
    VideoRecorderEventType,
    Set<EventCallback<VideoRecorderEventType>>
  > = new Map()

  constructor(config: VideoRecorderConfig = {}) {
    this.frameRate = config.frameRate ?? DEFAULT_FRAME_RATE
    this.videoBitsPerSecond = config.videoBitsPerSecond ?? DEFAULT_VIDEO_BITRATE

    // Create offscreen canvas for compositing
    this.recordingCanvas = document.createElement('canvas')
    const ctx = this.recordingCanvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to create 2D context for recording canvas')
    }
    this.recordingContext = ctx
  }

  /**
   * Set the recording format (aspect ratio).
   */
  setFormat(format: VideoFormat): void {
    if (this._isRecording) {
      throw new Error('Cannot change format while recording')
    }
    this._format = format
  }

  /**
   * Get the current format.
   */
  get format(): VideoFormat {
    return this._format
  }

  /**
   * Check if currently recording.
   */
  get isRecording(): boolean {
    return this._isRecording
  }

  /**
   * Get the recording canvas for compositing frames.
   * The visualizer should draw to this canvas during recording.
   */
  getRecordingCanvas(): HTMLCanvasElement {
    return this.recordingCanvas
  }

  /**
   * Get the recording canvas 2D context.
   */
  getRecordingContext(): CanvasRenderingContext2D {
    return this.recordingContext
  }

  /**
   * Get the dimensions for the current format.
   */
  getFormatDimensions(): { width: number; height: number } {
    const config = VIDEO_FORMATS[this._format]
    return { width: config.width, height: config.height }
  }

  /**
   * Start recording.
   * @param audioStream Optional audio stream to merge with video
   */
  start(audioStream?: MediaStream): void {
    if (this._isRecording) {
      throw new Error('Already recording')
    }

    // Configure canvas dimensions
    const { width, height } = this.getFormatDimensions()
    this.recordingCanvas.width = width
    this.recordingCanvas.height = height

    this.recordedChunks = []

    // Create video stream from canvas
    const canvasStream = this.recordingCanvas.captureStream(this.frameRate)

    // Merge audio if provided
    let combinedStream: MediaStream
    if (audioStream) {
      const tracks = [
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]
      combinedStream = new MediaStream(tracks)
    } else {
      combinedStream = canvasStream
    }

    // Detect best codec
    const mimeType = this.detectBestCodec()

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: this.videoBitsPerSecond,
      })
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Failed to create MediaRecorder')
      this.emit('error', err)
      throw err
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      this.handleRecordingComplete(mimeType)
    }

    this.mediaRecorder.onerror = (event) => {
      const error = new Error(`MediaRecorder error: ${event.type}`)
      this.emit('error', error)
    }

    this.mediaRecorder.start()
    this._isRecording = true
    this._startTime = Date.now()

    this.startTimer()
    this.emit('start', { format: this._format })
  }

  /**
   * Stop recording and trigger export.
   */
  stop(): void {
    if (!this._isRecording || !this.mediaRecorder) {
      return
    }

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    this._isRecording = false
    this.stopTimer()
    this.emit('stop', undefined)
  }

  /**
   * Get current recorder state.
   */
  getState(): VideoRecorderState {
    return {
      isRecording: this._isRecording,
      format: this._format,
      elapsedTime: this.getElapsedTime(),
    }
  }

  /**
   * Get elapsed recording time in seconds.
   */
  getElapsedTime(): number {
    if (!this._isRecording) {
      return 0
    }
    return Math.floor((Date.now() - this._startTime) / 1000)
  }

  /**
   * Get elapsed time formatted as MM:SS.
   */
  getElapsedTimeFormatted(): string {
    const elapsed = this.getElapsedTime()
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const seconds = String(elapsed % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  private detectBestCodec(): string {
    // Try VP9 first (better quality), then VP8, then default
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      return 'video/webm;codecs=vp9,opus'
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      return 'video/webm;codecs=vp8,opus'
    }
    return 'video/webm'
  }

  private handleRecordingComplete(mimeType: string): void {
    const blob = new Blob(this.recordedChunks, { type: mimeType })
    const filename = this.generateFilename()

    this.emit('complete', { blob, filename })
  }

  private generateFilename(): string {
    const formatName = this._format
    const timestamp = Date.now()
    return `phosphor-${formatName}-${timestamp}.webm`
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.emit('timeupdate', { elapsedTime: this.getElapsedTime() })
    }, 500)
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  // Event emitter methods

  on<T extends VideoRecorderEventType>(
    event: T,
    callback: EventCallback<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback<VideoRecorderEventType>)

    return () => this.off(event, callback)
  }

  off<T extends VideoRecorderEventType>(
    event: T,
    callback: EventCallback<T>
  ): void {
    this.listeners
      .get(event)
      ?.delete(callback as EventCallback<VideoRecorderEventType>)
  }

  private emit<T extends VideoRecorderEventType>(
    event: T,
    data: VideoRecorderEventMap[T]
  ): void {
    this.listeners.get(event)?.forEach((callback) => {
      callback(data)
    })
  }

  /**
   * Download a blob as a file.
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stop()
    this.recordedChunks = []
    this.listeners.clear()
  }
}
