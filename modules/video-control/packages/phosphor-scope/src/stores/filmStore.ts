import { create } from 'zustand'

interface FilmParams {
  grain: number
  weave: number
  flicker: number
  scratches: number
  lightLeaks: number
  dust: number
  colorFade: number
}

interface FilmActions {
  setGrain: (value: number) => void
  setWeave: (value: number) => void
  setFlicker: (value: number) => void
  setScratches: (value: number) => void
  setLightLeaks: (value: number) => void
  setDust: (value: number) => void
  setColorFade: (value: number) => void
}

type FilmStore = FilmParams & FilmActions

export const useFilmStore = create<FilmStore>((set) => ({
  // Default values from original
  grain: 0.4,
  weave: 0.4,
  flicker: 0.15,
  scratches: 0.3,
  lightLeaks: 0.3,
  dust: 0.5,
  colorFade: 0.15,

  setGrain: (value) => set({ grain: value }),
  setWeave: (value) => set({ weave: value }),
  setFlicker: (value) => set({ flicker: value }),
  setScratches: (value) => set({ scratches: value }),
  setLightLeaks: (value) => set({ lightLeaks: value }),
  setDust: (value) => set({ dust: value }),
  setColorFade: (value) => set({ colorFade: value }),
}))
