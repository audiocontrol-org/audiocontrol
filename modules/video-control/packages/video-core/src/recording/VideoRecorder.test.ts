import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VideoRecorder } from './VideoRecorder'
import type { VideoFormat } from '../types'

// Mock canvas and context
const mockContext = {
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  clearRect: vi.fn(),
}

const mockCanvasStream = {
  getVideoTracks: vi.fn(() => [{ kind: 'video' }]),
  getAudioTracks: vi.fn(() => []),
}

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockContext),
  captureStream: vi.fn(() => mockCanvasStream),
}

// Mock document.createElement
vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement
  }
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement
  }
  return document.createElement(tagName)
})

// Mock MediaRecorder
const mockMediaRecorder = {
  state: 'inactive' as RecordingState,
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null as ((event: BlobEvent) => void) | null,
  onstop: null as (() => void) | null,
  onerror: null as ((event: Event) => void) | null,
}

vi.stubGlobal(
  'MediaRecorder',
  Object.assign(
    vi.fn(() => mockMediaRecorder),
    {
      isTypeSupported: vi.fn((type: string) => {
        return type === 'video/webm;codecs=vp9,opus' || type === 'video/webm'
      }),
    }
  )
)

// Mock URL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
})

// Mock MediaStream
vi.stubGlobal(
  'MediaStream',
  vi.fn((tracks?: MediaStreamTrack[]) => ({
    getTracks: vi.fn(() => tracks ?? []),
    getVideoTracks: vi.fn(() => tracks?.filter((t) => t.kind === 'video') ?? []),
    getAudioTracks: vi.fn(() => tracks?.filter((t) => t.kind === 'audio') ?? []),
  }))
)

describe('VideoRecorder', () => {
  let recorder: VideoRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    mockMediaRecorder.state = 'inactive'
    recorder = new VideoRecorder()
  })

  describe('initialization', () => {
    it('should create with default config', () => {
      expect(recorder).toBeDefined()
      expect(recorder.isRecording).toBe(false)
      expect(recorder.format).toBe('youtube')
    })

    it('should accept custom frame rate', () => {
      const customRecorder = new VideoRecorder({ frameRate: 30 })
      expect(customRecorder).toBeDefined()
    })

    it('should accept custom bitrate', () => {
      const customRecorder = new VideoRecorder({ videoBitsPerSecond: 10_000_000 })
      expect(customRecorder).toBeDefined()
    })

    it('should create recording canvas', () => {
      expect(document.createElement).toHaveBeenCalledWith('canvas')
      expect(recorder.getRecordingCanvas()).toBeDefined()
      expect(recorder.getRecordingContext()).toBeDefined()
    })
  })

  describe('format management', () => {
    it('should default to youtube format', () => {
      expect(recorder.format).toBe('youtube')
    })

    it('should allow changing format', () => {
      recorder.setFormat('shorts')
      expect(recorder.format).toBe('shorts')
    })

    it('should return correct dimensions for each format', () => {
      const formats: VideoFormat[] = ['youtube', 'shorts', 'instagram', 'square']
      const expected = [
        { width: 1920, height: 1080 },
        { width: 1080, height: 1920 },
        { width: 1080, height: 1350 },
        { width: 1080, height: 1080 },
      ]

      formats.forEach((format, i) => {
        recorder.setFormat(format)
        expect(recorder.getFormatDimensions()).toEqual(expected[i])
      })
    })

    it('should throw when changing format while recording', () => {
      recorder.start()
      expect(() => recorder.setFormat('shorts')).toThrow(
        'Cannot change format while recording'
      )
    })
  })

  describe('recording lifecycle', () => {
    it('should start recording', () => {
      const startHandler = vi.fn()
      recorder.on('start', startHandler)

      recorder.start()

      expect(recorder.isRecording).toBe(true)
      expect(mockMediaRecorder.start).toHaveBeenCalled()
      expect(startHandler).toHaveBeenCalledWith({ format: 'youtube' })
    })

    it('should configure canvas dimensions on start', () => {
      recorder.setFormat('shorts')
      recorder.start()

      expect(mockCanvas.width).toBe(1080)
      expect(mockCanvas.height).toBe(1920)
    })

    it('should throw when starting while already recording', () => {
      recorder.start()
      expect(() => recorder.start()).toThrow('Already recording')
    })

    it('should stop recording', () => {
      const stopHandler = vi.fn()
      recorder.on('stop', stopHandler)

      recorder.start()
      mockMediaRecorder.state = 'recording'
      recorder.stop()

      expect(recorder.isRecording).toBe(false)
      expect(mockMediaRecorder.stop).toHaveBeenCalled()
      expect(stopHandler).toHaveBeenCalled()
    })

    it('should handle stop when not recording', () => {
      expect(() => recorder.stop()).not.toThrow()
    })

    it('should merge audio stream when provided', () => {
      const mockAudioStream = {
        getAudioTracks: vi.fn(() => [{ kind: 'audio' }]),
      } as unknown as MediaStream

      recorder.start(mockAudioStream)

      expect(mockAudioStream.getAudioTracks).toHaveBeenCalled()
    })
  })

  describe('state management', () => {
    it('should return correct initial state', () => {
      const state = recorder.getState()
      expect(state).toEqual({
        isRecording: false,
        format: 'youtube',
        elapsedTime: 0,
      })
    })

    it('should update state when recording', () => {
      recorder.start()
      const state = recorder.getState()
      expect(state.isRecording).toBe(true)
    })

    it('should format elapsed time correctly', () => {
      expect(recorder.getElapsedTimeFormatted()).toBe('00:00')
    })
  })

  describe('codec detection', () => {
    it('should prefer VP9 codec', () => {
      recorder.start()
      expect(MediaRecorder).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          mimeType: 'video/webm;codecs=vp9,opus',
        })
      )
    })

    it('should fall back to VP8 if VP9 not supported', () => {
      vi.mocked(MediaRecorder.isTypeSupported).mockImplementation(
        (type: string) => type === 'video/webm;codecs=vp8,opus'
      )

      const recorder2 = new VideoRecorder()
      recorder2.start()

      expect(MediaRecorder).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          mimeType: 'video/webm;codecs=vp8,opus',
        })
      )
    })
  })

  describe('events', () => {
    it('should emit complete event with blob on stop', () => {
      const completeHandler = vi.fn()
      recorder.on('complete', completeHandler)

      recorder.start()

      // Simulate data available
      const mockBlob = new Blob(['video data'], { type: 'video/webm' })
      mockMediaRecorder.ondataavailable?.({
        data: mockBlob,
      } as BlobEvent)

      // Simulate stop
      mockMediaRecorder.onstop?.()

      expect(completeHandler).toHaveBeenCalledWith({
        blob: expect.any(Blob),
        filename: expect.stringMatching(/^phosphor-youtube-\d+\.webm$/),
      })
    })

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn()
      const unsubscribe = recorder.on('start', handler)

      unsubscribe()
      recorder.start()

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('static methods', () => {
    it('should download blob', () => {
      const mockBlob = new Blob(['test'], { type: 'video/webm' })
      const mockAnchor = { href: '', download: '', click: vi.fn() }
      vi.spyOn(document, 'createElement').mockReturnValueOnce(
        mockAnchor as unknown as HTMLAnchorElement
      )

      VideoRecorder.downloadBlob(mockBlob, 'test.webm')

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockAnchor.download).toBe('test.webm')
      expect(mockAnchor.click).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('should dispose resources', () => {
      recorder.start()
      mockMediaRecorder.state = 'recording'
      recorder.dispose()

      expect(recorder.isRecording).toBe(false)
    })
  })
})
