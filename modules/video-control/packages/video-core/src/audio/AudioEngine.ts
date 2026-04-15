import type {
  AudioEngineConfig,
  AudioAnalysisData,
  AudioEngineState,
  AudioEngineEventType,
  AudioEngineEventMap,
} from '../types'

type EventCallback<T extends AudioEngineEventType> = (
  data: AudioEngineEventMap[T]
) => void

const DEFAULT_FFT_SIZE = 2048
const DEFAULT_SMOOTHING = 0.8

/**
 * AudioEngine handles audio loading, playback, and analysis using Web Audio API.
 * Provides stereo channel splitting for Lissajous visualization and FFT data
 * for spectrum analysis.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null
  private analyserLeft: AnalyserNode | null = null
  private analyserRight: AnalyserNode | null = null
  private splitter: ChannelSplitterNode | null = null
  private source: AudioBufferSourceNode | null = null
  private audioBuffer: AudioBuffer | null = null

  private timeDomainLeft: Uint8Array<ArrayBuffer> | null = null
  private timeDomainRight: Uint8Array<ArrayBuffer> | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null

  private _isPlaying = false
  private _fileName: string | null = null
  private _startTime = 0
  private _pauseTime = 0

  private fftSize: number
  private smoothingTimeConstant: number

  private listeners: Map<AudioEngineEventType, Set<EventCallback<AudioEngineEventType>>> =
    new Map()

  constructor(config: AudioEngineConfig = {}) {
    this.fftSize = config.fftSize ?? DEFAULT_FFT_SIZE
    this.smoothingTimeConstant = config.smoothingTimeConstant ?? DEFAULT_SMOOTHING
  }

  /**
   * Initialize the Web Audio API context and nodes.
   * Must be called from a user interaction (click/keypress) in browsers.
   */
  init(): void {
    if (this.audioContext) return

    this.audioContext = new AudioContext()
    this.analyserLeft = this.audioContext.createAnalyser()
    this.analyserRight = this.audioContext.createAnalyser()
    this.splitter = this.audioContext.createChannelSplitter(2)

    this.configureAnalysers()
    this.allocateBuffers()
  }

  private configureAnalysers(): void {
    if (!this.analyserLeft || !this.analyserRight) return

    this.analyserLeft.fftSize = this.fftSize
    this.analyserLeft.smoothingTimeConstant = this.smoothingTimeConstant
    this.analyserRight.fftSize = this.fftSize
    this.analyserRight.smoothingTimeConstant = this.smoothingTimeConstant
  }

  private allocateBuffers(): void {
    if (!this.analyserLeft) return

    this.timeDomainLeft = new Uint8Array(this.fftSize)
    this.timeDomainRight = new Uint8Array(this.fftSize)
    this.frequencyData = new Uint8Array(this.analyserLeft.frequencyBinCount)
  }

  /**
   * Load an audio file and decode it.
   */
  async loadFile(file: File): Promise<void> {
    this.init()

    if (!this.audioContext) {
      throw new Error('AudioContext not initialized')
    }

    // Stop any current playback
    this.stop()

    try {
      const arrayBuffer = await file.arrayBuffer()
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this._fileName = file.name
      this._pauseTime = 0

      this.emit('loaded', {
        fileName: file.name,
        duration: this.audioBuffer.duration,
      })
      this.emitStateChange()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Start or resume playback.
   */
  play(): void {
    if (!this.audioBuffer || !this.audioContext) return
    if (this._isPlaying) return

    // Resume context if suspended (autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    this.createAndStartSource(this._pauseTime)
  }

  /**
   * Pause playback (can be resumed).
   */
  pause(): void {
    if (!this._isPlaying || !this.audioContext) return

    this._pauseTime = this.audioContext.currentTime - this._startTime
    this.disconnectSource()
    this._isPlaying = false
    this.emitStateChange()
  }

  /**
   * Stop playback and reset to beginning.
   */
  stop(): void {
    this.disconnectSource()
    this._isPlaying = false
    this._pauseTime = 0
    this.emitStateChange()
  }

  /**
   * Toggle between play and pause.
   */
  togglePlayback(): void {
    if (this._isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  /**
   * Seek to a specific time in seconds.
   */
  seek(time: number): void {
    if (!this.audioBuffer) return

    const wasPlaying = this._isPlaying
    this.stop()
    this._pauseTime = Math.max(0, Math.min(time, this.audioBuffer.duration))

    if (wasPlaying) {
      this.play()
    } else {
      this.emitStateChange()
    }
  }

  private createAndStartSource(offset: number): void {
    if (!this.audioBuffer || !this.audioContext || !this.splitter) return
    if (!this.analyserLeft || !this.analyserRight) return

    this.source = this.audioContext.createBufferSource()
    this.source.buffer = this.audioBuffer

    // Connect: source -> splitter -> analysers (L/R)
    this.source.connect(this.splitter)
    this.splitter.connect(this.analyserLeft, 0)
    this.splitter.connect(this.analyserRight, 1)

    // Also connect to destination for audio output
    this.source.connect(this.audioContext.destination)

    this.source.onended = () => {
      // Only emit ended if we weren't manually stopped
      if (this._isPlaying) {
        this._isPlaying = false
        this._pauseTime = 0
        this.emit('ended', undefined)
        this.emitStateChange()
      }
    }

    this._startTime = this.audioContext.currentTime - offset
    this.source.start(0, offset)
    this._isPlaying = true
    this.emitStateChange()
  }

  private disconnectSource(): void {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        // Already stopped
      }
      this.source.disconnect()
      this.source = null
    }
  }

  /**
   * Get current analysis data for visualization.
   * Call this on each animation frame.
   */
  getAnalysisData(): AudioAnalysisData | null {
    if (!this.analyserLeft || !this.analyserRight) return null
    if (!this.timeDomainLeft || !this.timeDomainRight || !this.frequencyData) {
      return null
    }

    this.analyserLeft.getByteTimeDomainData(this.timeDomainLeft)
    this.analyserRight.getByteTimeDomainData(this.timeDomainRight)
    this.analyserLeft.getByteFrequencyData(this.frequencyData)

    return {
      timeDomainLeft: this.timeDomainLeft,
      timeDomainRight: this.timeDomainRight,
      frequencyData: this.frequencyData,
    }
  }

  /**
   * Update FFT size. Larger values = more frequency resolution, more latency.
   * Must be a power of 2 between 32 and 32768.
   */
  setFFTSize(size: number): void {
    if (size < 32 || size > 32768 || !Number.isInteger(Math.log2(size))) {
      throw new Error('FFT size must be a power of 2 between 32 and 32768')
    }

    this.fftSize = size
    this.configureAnalysers()
    this.allocateBuffers()
  }

  /**
   * Update smoothing time constant (0-1).
   * Higher values = smoother but less responsive.
   */
  setSmoothingTimeConstant(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error('Smoothing time constant must be between 0 and 1')
    }

    this.smoothingTimeConstant = value
    if (this.analyserLeft) {
      this.analyserLeft.smoothingTimeConstant = value
    }
    if (this.analyserRight) {
      this.analyserRight.smoothingTimeConstant = value
    }
  }

  /**
   * Get the AudioContext for advanced usage (e.g., recording).
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  /**
   * Get the audio buffer for advanced usage.
   */
  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer
  }

  /**
   * Create a MediaStreamDestination for recording.
   */
  createMediaStreamDestination(): MediaStreamAudioDestinationNode | null {
    if (!this.audioContext) return null
    return this.audioContext.createMediaStreamDestination()
  }

  /**
   * Get current engine state.
   */
  getState(): AudioEngineState {
    return {
      isPlaying: this._isPlaying,
      isLoaded: this.audioBuffer !== null,
      duration: this.audioBuffer?.duration ?? 0,
      currentTime: this.getCurrentTime(),
      fileName: this._fileName,
    }
  }

  /**
   * Get current playback time in seconds.
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this._isPlaying) {
      return this._pauseTime
    }
    return this.audioContext.currentTime - this._startTime
  }

  /**
   * Check if audio is currently playing.
   */
  get isPlaying(): boolean {
    return this._isPlaying
  }

  /**
   * Check if audio is loaded.
   */
  get isLoaded(): boolean {
    return this.audioBuffer !== null
  }

  /**
   * Get duration of loaded audio in seconds.
   */
  get duration(): number {
    return this.audioBuffer?.duration ?? 0
  }

  /**
   * Get the loaded file name.
   */
  get fileName(): string | null {
    return this._fileName
  }

  // Event emitter methods

  on<T extends AudioEngineEventType>(
    event: T,
    callback: EventCallback<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback<AudioEngineEventType>)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  off<T extends AudioEngineEventType>(
    event: T,
    callback: EventCallback<T>
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<AudioEngineEventType>)
  }

  private emit<T extends AudioEngineEventType>(
    event: T,
    data: AudioEngineEventMap[T]
  ): void {
    this.listeners.get(event)?.forEach((callback) => {
      callback(data)
    })
  }

  private emitStateChange(): void {
    this.emit('statechange', this.getState())
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.analyserLeft = null
    this.analyserRight = null
    this.splitter = null
    this.audioBuffer = null
    this.timeDomainLeft = null
    this.timeDomainRight = null
    this.frequencyData = null
    this.listeners.clear()
  }
}
