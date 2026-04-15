import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioEngine } from './AudioEngine'

// Helper to create a mock file with arrayBuffer support
function createMockFile(name: string, type: string): File {
  const file = new File(['audio data'], name, { type })
  // jsdom doesn't implement arrayBuffer(), so we mock it
  file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8))
  return file
}

// Mock Web Audio API
const mockAnalyserNode = {
  fftSize: 2048,
  frequencyBinCount: 1024,
  smoothingTimeConstant: 0.8,
  getByteTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
}

const mockSplitterNode = {
  connect: vi.fn(),
}

const mockSourceNode = {
  buffer: null as AudioBuffer | null,
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
  onended: null as (() => void) | null,
}

const mockAudioContext = {
  state: 'running' as AudioContextState,
  currentTime: 0,
  destination: {},
  createAnalyser: vi.fn(() => ({ ...mockAnalyserNode })),
  createChannelSplitter: vi.fn(() => ({ ...mockSplitterNode })),
  createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
  createMediaStreamDestination: vi.fn(),
  decodeAudioData: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
}

// Mock global AudioContext
vi.stubGlobal(
  'AudioContext',
  vi.fn(() => mockAudioContext)
)

describe('AudioEngine', () => {
  let engine: AudioEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new AudioEngine()
  })

  describe('initialization', () => {
    it('should create with default config', () => {
      expect(engine).toBeDefined()
      expect(engine.isPlaying).toBe(false)
      expect(engine.isLoaded).toBe(false)
    })

    it('should accept custom FFT size', () => {
      const customEngine = new AudioEngine({ fftSize: 4096 })
      expect(customEngine).toBeDefined()
    })

    it('should accept custom smoothing', () => {
      const customEngine = new AudioEngine({ smoothingTimeConstant: 0.5 })
      expect(customEngine).toBeDefined()
    })

    it('should initialize audio context on init()', () => {
      engine.init()
      expect(AudioContext).toHaveBeenCalled()
      expect(mockAudioContext.createAnalyser).toHaveBeenCalledTimes(2)
      expect(mockAudioContext.createChannelSplitter).toHaveBeenCalledWith(2)
    })

    it('should only initialize once', () => {
      engine.init()
      engine.init()
      expect(AudioContext).toHaveBeenCalledTimes(1)
    })
  })

  describe('state management', () => {
    it('should return correct initial state', () => {
      const state = engine.getState()
      expect(state).toEqual({
        isPlaying: false,
        isLoaded: false,
        duration: 0,
        currentTime: 0,
        fileName: null,
      })
    })

    it('should have correct initial property values', () => {
      expect(engine.isPlaying).toBe(false)
      expect(engine.isLoaded).toBe(false)
      expect(engine.duration).toBe(0)
      expect(engine.fileName).toBeNull()
    })
  })

  describe('file loading', () => {
    it('should initialize context when loading file', async () => {
      const mockBuffer = {
        duration: 120,
        length: 1000,
        numberOfChannels: 2,
        sampleRate: 44100,
      } as AudioBuffer

      mockAudioContext.decodeAudioData.mockResolvedValue(mockBuffer)

      const file = createMockFile('test.mp3', 'audio/mp3')
      await engine.loadFile(file)

      expect(AudioContext).toHaveBeenCalled()
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled()
      expect(engine.isLoaded).toBe(true)
      expect(engine.fileName).toBe('test.mp3')
      expect(engine.duration).toBe(120)
    })

    it('should emit loaded event', async () => {
      const mockBuffer = { duration: 60 } as AudioBuffer
      mockAudioContext.decodeAudioData.mockResolvedValue(mockBuffer)

      const loadedHandler = vi.fn()
      engine.on('loaded', loadedHandler)

      const file = createMockFile('song.wav', 'audio/wav')
      await engine.loadFile(file)

      expect(loadedHandler).toHaveBeenCalledWith({
        fileName: 'song.wav',
        duration: 60,
      })
    })

    it('should emit error on decode failure', async () => {
      const error = new Error('Decode failed')
      mockAudioContext.decodeAudioData.mockRejectedValue(error)

      const errorHandler = vi.fn()
      engine.on('error', errorHandler)

      const file = createMockFile('bad.mp3', 'audio/mp3')

      await expect(engine.loadFile(file)).rejects.toThrow('Decode failed')
      expect(errorHandler).toHaveBeenCalledWith(error)
    })
  })

  describe('event system', () => {
    it('should allow subscribing to events', () => {
      const handler = vi.fn()
      const unsubscribe = engine.on('statechange', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn()
      const unsubscribe = engine.on('statechange', handler)

      unsubscribe()

      // Handler should not be called after unsubscribe
      engine.init()
      engine.stop() // This triggers statechange
      expect(handler).not.toHaveBeenCalled()
    })

    it('should emit statechange on stop', async () => {
      const mockBuffer = { duration: 60 } as AudioBuffer
      mockAudioContext.decodeAudioData.mockResolvedValue(mockBuffer)

      const stateHandler = vi.fn()
      engine.on('statechange', stateHandler)

      const file = createMockFile('test.mp3', 'audio/mp3')
      await engine.loadFile(file)

      stateHandler.mockClear()
      engine.stop()

      expect(stateHandler).toHaveBeenCalled()
    })
  })

  describe('FFT configuration', () => {
    it('should accept valid FFT sizes', () => {
      engine.init()
      expect(() => engine.setFFTSize(1024)).not.toThrow()
      expect(() => engine.setFFTSize(2048)).not.toThrow()
      expect(() => engine.setFFTSize(4096)).not.toThrow()
    })

    it('should reject invalid FFT sizes', () => {
      engine.init()
      expect(() => engine.setFFTSize(1000)).toThrow()
      expect(() => engine.setFFTSize(16)).toThrow()
      expect(() => engine.setFFTSize(65536)).toThrow()
    })

    it('should accept valid smoothing values', () => {
      engine.init()
      expect(() => engine.setSmoothingTimeConstant(0)).not.toThrow()
      expect(() => engine.setSmoothingTimeConstant(0.5)).not.toThrow()
      expect(() => engine.setSmoothingTimeConstant(1)).not.toThrow()
    })

    it('should reject invalid smoothing values', () => {
      engine.init()
      expect(() => engine.setSmoothingTimeConstant(-0.1)).toThrow()
      expect(() => engine.setSmoothingTimeConstant(1.1)).toThrow()
    })
  })

  describe('analysis data', () => {
    it('should return null before initialization', () => {
      expect(engine.getAnalysisData()).toBeNull()
    })

    it('should return analysis data after initialization', () => {
      engine.init()
      const data = engine.getAnalysisData()
      expect(data).not.toBeNull()
      expect(data!.timeDomainLeft).toBeInstanceOf(Uint8Array)
      expect(data!.timeDomainRight).toBeInstanceOf(Uint8Array)
      expect(data!.frequencyData).toBeInstanceOf(Uint8Array)
    })
  })

  describe('cleanup', () => {
    it('should dispose resources', () => {
      engine.init()
      engine.dispose()

      expect(mockAudioContext.close).toHaveBeenCalled()
      expect(engine.getAudioContext()).toBeNull()
      expect(engine.getAudioBuffer()).toBeNull()
    })
  })
})
