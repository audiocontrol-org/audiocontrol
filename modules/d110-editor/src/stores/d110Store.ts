/**
 * Zustand store for D-110 device data
 *
 * Manages tone and patch data state with hardware synchronization.
 */

import { create } from 'zustand';
import type {
  D110Tone,
  D110Patch,
  SystemParams,
  PartConfig,
  ToneCommon,
} from '@/core/midi/types';

interface D110State {
  // Current tone data for each part (0-7)
  tones: Map<number, D110Tone>;

  // System parameters
  systemParams: SystemParams | null;

  // Part configurations
  partConfigs: PartConfig[];

  // Full patch data
  patch: D110Patch | null;

  // Currently selected part for editing (0-7)
  selectedPart: number;

  // UI state
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;

  // Dirty tracking for unsaved changes
  dirtyParts: Set<number>;
}

interface D110Actions {
  // Tone operations
  setTone: (partIndex: number, tone: D110Tone) => void;
  updateToneCommon: (partIndex: number, updates: Partial<ToneCommon>) => void;
  clearTone: (partIndex: number) => void;

  // System operations
  setSystemParams: (params: SystemParams) => void;
  updateSystemParam: (key: keyof SystemParams, value: number | number[]) => void;

  // Part operations
  setPartConfig: (partIndex: number, config: PartConfig) => void;
  setAllPartConfigs: (configs: PartConfig[]) => void;

  // Patch operations
  setPatch: (patch: D110Patch) => void;

  // Selection
  selectPart: (partIndex: number) => void;

  // UI state
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;

  // Dirty tracking
  markDirty: (partIndex: number) => void;
  clearDirty: (partIndex: number) => void;
  clearAllDirty: () => void;

  // Reset
  clear: () => void;
}

type D110Store = D110State & D110Actions;

export const useD110Store = create<D110Store>((set) => ({
  // Initial state
  tones: new Map(),
  systemParams: null,
  partConfigs: [],
  patch: null,
  selectedPart: 0,
  isLoading: false,
  loadingMessage: null,
  error: null,
  dirtyParts: new Set(),

  setTone: (partIndex, tone) =>
    set((state) => {
      const newTones = new Map(state.tones);
      newTones.set(partIndex, tone);
      return { tones: newTones };
    }),

  updateToneCommon: (partIndex, updates) =>
    set((state) => {
      const tone = state.tones.get(partIndex);
      if (!tone) return state;

      const newTone: D110Tone = {
        ...tone,
        common: {
          ...tone.common,
          ...updates,
        },
      };

      const newTones = new Map(state.tones);
      newTones.set(partIndex, newTone);

      const newDirtyParts = new Set(state.dirtyParts);
      newDirtyParts.add(partIndex);

      return { tones: newTones, dirtyParts: newDirtyParts };
    }),

  clearTone: (partIndex) =>
    set((state) => {
      const newTones = new Map(state.tones);
      newTones.delete(partIndex);
      return { tones: newTones };
    }),

  setSystemParams: (params) => set({ systemParams: params }),

  updateSystemParam: (key, value) =>
    set((state) => {
      if (!state.systemParams) return state;
      return {
        systemParams: {
          ...state.systemParams,
          [key]: value,
        },
      };
    }),

  setPartConfig: (partIndex, config) =>
    set((state) => {
      const newConfigs = [...state.partConfigs];
      newConfigs[partIndex] = config;
      return { partConfigs: newConfigs };
    }),

  setAllPartConfigs: (configs) => set({ partConfigs: configs }),

  setPatch: (patch) =>
    set({
      patch,
      systemParams: patch.system,
      partConfigs: patch.parts,
    }),

  selectPart: (partIndex) => {
    if (partIndex >= 0 && partIndex <= 7) {
      set({ selectedPart: partIndex });
    }
  },

  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  markDirty: (partIndex) =>
    set((state) => {
      const newDirtyParts = new Set(state.dirtyParts);
      newDirtyParts.add(partIndex);
      return { dirtyParts: newDirtyParts };
    }),

  clearDirty: (partIndex) =>
    set((state) => {
      const newDirtyParts = new Set(state.dirtyParts);
      newDirtyParts.delete(partIndex);
      return { dirtyParts: newDirtyParts };
    }),

  clearAllDirty: () => set({ dirtyParts: new Set() }),

  clear: () =>
    set({
      tones: new Map(),
      systemParams: null,
      partConfigs: [],
      patch: null,
      selectedPart: 0,
      error: null,
      dirtyParts: new Set(),
    }),
}));

// Selector helpers
export const selectCurrentTone = (state: D110State): D110Tone | undefined =>
  state.tones.get(state.selectedPart);

export const selectToneCommon = (state: D110State): ToneCommon | undefined =>
  state.tones.get(state.selectedPart)?.common;

export const selectPartConfig = (state: D110State): PartConfig | undefined =>
  state.partConfigs[state.selectedPart];
