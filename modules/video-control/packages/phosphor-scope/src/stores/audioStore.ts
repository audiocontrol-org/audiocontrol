import { create } from 'zustand'
import { AudioEngine } from '@audiocontrol/video-core'
import type { AudioEngineState } from '@audiocontrol/video-core'

interface AudioState {
  engine: AudioEngine
  isLoaded: boolean
  isPlaying: boolean
  fileName: string | null
  duration: number
  currentTime: number
}

interface AudioActions {
  loadFile: (file: File) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  togglePlayback: () => void
  setSmoothing: (value: number) => void
  setFFTSize: (size: number) => void
}

type AudioStore = AudioState & AudioActions

export const useAudioStore = create<AudioStore>((set, get) => {
  const engine = new AudioEngine()

  // Subscribe to engine events
  engine.on('statechange', (state: AudioEngineState) => {
    set({
      isLoaded: state.isLoaded,
      isPlaying: state.isPlaying,
      fileName: state.fileName,
      duration: state.duration,
      currentTime: state.currentTime,
    })
  })

  engine.on('ended', () => {
    set({ isPlaying: false })
  })

  return {
    engine,
    isLoaded: false,
    isPlaying: false,
    fileName: null,
    duration: 0,
    currentTime: 0,

    loadFile: async (file: File) => {
      await get().engine.loadFile(file)
    },

    play: () => {
      get().engine.play()
    },

    pause: () => {
      get().engine.pause()
    },

    stop: () => {
      get().engine.stop()
    },

    togglePlayback: () => {
      get().engine.togglePlayback()
    },

    setSmoothing: (value: number) => {
      get().engine.setSmoothingTimeConstant(value)
    },

    setFFTSize: (size: number) => {
      get().engine.setFFTSize(size)
    },
  }
})
