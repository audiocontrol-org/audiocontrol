/**
 * Zustand store for S-330 device data
 *
 * Uses a two-tier approach:
 * - Name lists for quick browsing (fetched with requestAllPatchNames/requestAllToneNames)
 * - Full data fetched on demand when a patch/tone is selected
 */

import { create } from 'zustand';
import type {
  S330Patch,
  S330Tone,
  PatchNameInfo,
  ToneNameInfo,
} from '@/core/midi/S330Client';

interface S330State {
  // Name lists for browsing (lightweight)
  patchNames: PatchNameInfo[];
  toneNames: ToneNameInfo[];

  // Full data (fetched on demand)
  patches: Map<number, S330Patch>;
  tones: Map<number, S330Tone>;

  // Selection state
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;

  // UI state
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
}

interface S330Actions {
  // Name list actions
  setPatchNames: (names: PatchNameInfo[]) => void;
  setToneNames: (names: ToneNameInfo[]) => void;

  // Full data actions
  setPatchData: (index: number, patch: S330Patch) => void;
  setToneData: (index: number, tone: S330Tone) => void;

  // Selection
  selectPatch: (index: number | null) => void;
  selectTone: (index: number | null) => void;

  // UI state
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

type S330Store = S330State & S330Actions;

export const useS330Store = create<S330Store>((set) => ({
  // Initial state
  patchNames: [],
  toneNames: [],
  patches: new Map(),
  tones: new Map(),
  selectedPatchIndex: null,
  selectedToneIndex: null,
  isLoading: false,
  loadingMessage: null,
  error: null,

  setPatchNames: (names) => set({ patchNames: names }),

  setToneNames: (names) => set({ toneNames: names }),

  setPatchData: (index, patch) =>
    set((state) => {
      const newPatches = new Map(state.patches);
      newPatches.set(index, patch);
      return { patches: newPatches };
    }),

  setToneData: (index, tone) =>
    set((state) => {
      const newTones = new Map(state.tones);
      newTones.set(index, tone);
      return { tones: newTones };
    }),

  selectPatch: (index) => set({ selectedPatchIndex: index }),

  selectTone: (index) => set({ selectedToneIndex: index }),

  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      patchNames: [],
      toneNames: [],
      patches: new Map(),
      tones: new Map(),
      selectedPatchIndex: null,
      selectedToneIndex: null,
      error: null,
    }),
}));
