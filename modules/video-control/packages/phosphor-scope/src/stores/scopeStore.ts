import { create } from 'zustand'
import type { VisualizationMode, PhosphorColor } from '@audiocontrol/video-core'

interface ScopeParams {
  mode: VisualizationMode
  color: PhosphorColor
  persistence: number
  glowIntensity: number
  beamWidth: number
  bloomRadius: number
  gain: number
  density: number
  scanlineAlpha: number
  noiseAmount: number
  flickerAmount: number
}

interface ScopeActions {
  setMode: (mode: VisualizationMode) => void
  setColor: (color: PhosphorColor) => void
  setPersistence: (value: number) => void
  setGlowIntensity: (value: number) => void
  setBeamWidth: (value: number) => void
  setBloomRadius: (value: number) => void
  setGain: (value: number) => void
  setDensity: (value: number) => void
  setScanlineAlpha: (value: number) => void
  setNoiseAmount: (value: number) => void
  setFlickerAmount: (value: number) => void
}

type ScopeStore = ScopeParams & ScopeActions

export const useScopeStore = create<ScopeStore>((set) => ({
  // Default values from original
  mode: 'waveform',
  color: 'green',
  persistence: 0.85,
  glowIntensity: 1.5,
  beamWidth: 2.0,
  bloomRadius: 12,
  gain: 1.0,
  density: 1.0,
  scanlineAlpha: 0.08,
  noiseAmount: 0.02,
  flickerAmount: 0.02,

  setMode: (mode) => set({ mode }),
  setColor: (color) => set({ color }),
  setPersistence: (value) => set({ persistence: value }),
  setGlowIntensity: (value) => set({ glowIntensity: value }),
  setBeamWidth: (value) => set({ beamWidth: value }),
  setBloomRadius: (value) => set({ bloomRadius: value }),
  setGain: (value) => set({ gain: value }),
  setDensity: (value) => set({ density: value }),
  setScanlineAlpha: (value) => set({ scanlineAlpha: value }),
  setNoiseAmount: (value) => set({ noiseAmount: value }),
  setFlickerAmount: (value) => set({ flickerAmount: value }),
}))
