import { create } from 'zustand'
import type { VideoFormat } from '@audiocontrol/video-core'

interface RecordingState {
  isRecording: boolean
  format: VideoFormat
  elapsedTime: number
}

interface RecordingActions {
  setFormat: (format: VideoFormat) => void
  setIsRecording: (isRecording: boolean) => void
  setElapsedTime: (time: number) => void
  reset: () => void
}

type RecordingStore = RecordingState & RecordingActions

export const useRecordingStore = create<RecordingStore>((set) => ({
  isRecording: false,
  format: 'youtube',
  elapsedTime: 0,

  setFormat: (format) => set({ format }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setElapsedTime: (elapsedTime) => set({ elapsedTime }),
  reset: () => set({ isRecording: false, elapsedTime: 0 }),
}))
