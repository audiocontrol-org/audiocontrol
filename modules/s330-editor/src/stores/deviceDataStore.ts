/**
 * Zustand store for S-330 device data (patches and tones)
 *
 * Caches loaded patches and tones at the application level so they
 * persist across page navigation. Each page no longer needs to reload
 * data when switching between Patches and Tones views.
 */

import { create } from 'zustand';
import type { S330Patch, S330Tone } from '@/core/midi/S330Client';

// Constants for bank management
const PATCHES_PER_BANK = 8;
const TONES_PER_BANK = 8;
const TOTAL_PATCHES = 16; // 2 banks of 8
const TOTAL_TONES = 32; // 4 banks of 8

interface DeviceDataState {
  // Patch data (sparse array - undefined = not loaded)
  patches: (S330Patch | undefined)[];
  // Tone data (sparse array - undefined = not loaded)
  tones: (S330Tone | undefined)[];
  // Track which banks have been loaded (as arrays for Zustand compatibility)
  loadedPatchBanks: number[];
  loadedToneBanks: number[];
}

interface DeviceDataActions {
  // Patch operations
  setPatch: (index: number, patch: S330Patch) => void;
  setPatches: (patches: (S330Patch | undefined)[]) => void;
  markPatchBankLoaded: (bankIndex: number) => void;
  isPatchBankLoaded: (bankIndex: number) => boolean;
  invalidatePatchCache: () => void;

  // Tone operations
  setTone: (index: number, tone: S330Tone) => void;
  setTones: (tones: (S330Tone | undefined)[]) => void;
  markToneBankLoaded: (bankIndex: number) => void;
  isToneBankLoaded: (bankIndex: number) => boolean;
  invalidateToneCache: () => void;

  // Bulk operations
  invalidateAllCache: () => void;

  // Ensure arrays are sized correctly
  ensurePatchArraySize: () => void;
  ensureToneArraySize: () => void;
}

type DeviceDataStore = DeviceDataState & DeviceDataActions;

export const useDeviceDataStore = create<DeviceDataStore>((set, get) => ({
  // Initial state
  patches: [],
  tones: [],
  loadedPatchBanks: [],
  loadedToneBanks: [],

  // Patch operations
  setPatch: (index, patch) =>
    set((state) => {
      const patches = [...state.patches];
      while (patches.length < TOTAL_PATCHES) patches.push(undefined);
      patches[index] = patch;
      return { patches };
    }),

  setPatches: (patches) => set({ patches }),

  markPatchBankLoaded: (bankIndex) =>
    set((state) => {
      if (state.loadedPatchBanks.includes(bankIndex)) return state;
      return { loadedPatchBanks: [...state.loadedPatchBanks, bankIndex] };
    }),

  isPatchBankLoaded: (bankIndex) => get().loadedPatchBanks.includes(bankIndex),

  invalidatePatchCache: () =>
    set({
      patches: [],
      loadedPatchBanks: [],
    }),

  // Tone operations
  setTone: (index, tone) =>
    set((state) => {
      const tones = [...state.tones];
      while (tones.length < TOTAL_TONES) tones.push(undefined);
      tones[index] = tone;
      return { tones };
    }),

  setTones: (tones) => set({ tones }),

  markToneBankLoaded: (bankIndex) =>
    set((state) => {
      if (state.loadedToneBanks.includes(bankIndex)) return state;
      return { loadedToneBanks: [...state.loadedToneBanks, bankIndex] };
    }),

  isToneBankLoaded: (bankIndex) => get().loadedToneBanks.includes(bankIndex),

  invalidateToneCache: () =>
    set({
      tones: [],
      loadedToneBanks: [],
    }),

  // Bulk operations
  invalidateAllCache: () =>
    set({
      patches: [],
      tones: [],
      loadedPatchBanks: [],
      loadedToneBanks: [],
    }),

  // Ensure arrays are sized correctly
  ensurePatchArraySize: () =>
    set((state) => {
      if (state.patches.length >= TOTAL_PATCHES) return state;
      const patches = [...state.patches];
      while (patches.length < TOTAL_PATCHES) patches.push(undefined);
      return { patches };
    }),

  ensureToneArraySize: () =>
    set((state) => {
      if (state.tones.length >= TOTAL_TONES) return state;
      const tones = [...state.tones];
      while (tones.length < TOTAL_TONES) tones.push(undefined);
      return { tones };
    }),
}));

// Helper selectors
export const selectLoadedPatches = (state: DeviceDataState) =>
  state.patches.filter((p): p is S330Patch => p !== undefined);

export const selectLoadedTones = (state: DeviceDataState) =>
  state.tones.filter((t): t is S330Tone => t !== undefined);

// Export constants for use in pages
export { PATCHES_PER_BANK, TONES_PER_BANK, TOTAL_PATCHES, TOTAL_TONES };
