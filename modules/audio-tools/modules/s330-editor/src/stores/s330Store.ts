/**
 * Zustand store for S-330 device data
 */

import { create } from 'zustand';
import type { S330Patch, S330Tone } from '@/core/midi/S330Client';

interface S330State {
  patches: S330Patch[];
  tones: S330Tone[];
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
}

interface S330Actions {
  setPatches: (patches: S330Patch[]) => void;
  setTones: (tones: S330Tone[]) => void;
  selectPatch: (index: number | null) => void;
  selectTone: (index: number | null) => void;
  updatePatch: (index: number, patch: S330Patch) => void;
  updateTone: (index: number, tone: S330Tone) => void;
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

type S330Store = S330State & S330Actions;

export const useS330Store = create<S330Store>((set) => ({
  // Initial state
  patches: [],
  tones: [],
  selectedPatchIndex: null,
  selectedToneIndex: null,
  isLoading: false,
  loadingMessage: null,
  error: null,

  setPatches: (patches) => set({ patches }),

  setTones: (tones) => set({ tones }),

  selectPatch: (index) => set({ selectedPatchIndex: index }),

  selectTone: (index) => set({ selectedToneIndex: index }),

  updatePatch: (index, patch) =>
    set((state) => ({
      patches: state.patches.map((p, i) => (i === index ? patch : p)),
    })),

  updateTone: (index, tone) =>
    set((state) => ({
      tones: state.tones.map((t, i) => (i === index ? tone : t)),
    })),

  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      patches: [],
      tones: [],
      selectedPatchIndex: null,
      selectedToneIndex: null,
      error: null,
    }),
}));
