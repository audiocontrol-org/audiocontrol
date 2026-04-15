import { useEffect } from 'react'
import { useAudioStore, useScopeStore } from '@/stores'
import { useRecording } from './useRecording'
import type { VisualizationMode } from '@audiocontrol/video-core'

const MODE_KEYS: Record<string, VisualizationMode> = {
  '1': 'waveform',
  '2': 'lissajous',
  '3': 'spectrum',
}

export function useKeyboardShortcuts() {
  const { isLoaded, togglePlayback } = useAudioStore()
  const { setMode } = useScopeStore()
  const { toggleRecording } = useRecording()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Space: play/pause
      if (e.code === 'Space') {
        e.preventDefault()
        if (isLoaded) {
          togglePlayback()
        }
        return
      }

      // R: toggle recording
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        if (isLoaded) {
          toggleRecording()
        }
        return
      }

      // 1/2/3: switch visualization mode
      const mode = MODE_KEYS[e.key]
      if (mode) {
        e.preventDefault()
        setMode(mode)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoaded, togglePlayback, toggleRecording, setMode])
}
