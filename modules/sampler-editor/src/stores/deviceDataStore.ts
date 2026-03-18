/**
 * Zustand store for sampler device data (patches and tones)
 *
 * This store is device-agnostic and works with any sampler device configuration.
 * The device-specific constants (total patches, total tones, etc.) are provided
 * via the DeviceConfig context.
 *
 * Caches loaded patches and tones at the application level so they persist
 * across page navigation.
 */

import { create } from 'zustand';
import type { SamplerPatch, SamplerTone } from '@/core/midi/SamplerClient';

type Patch = SamplerPatch;
type Tone = SamplerTone;

interface DeviceDataState {
  /** Current device type (for cache invalidation on device switch) */
  currentDeviceType: string | null;
  /** Patch data (sparse array - undefined = not loaded) */
  patches: (Patch | undefined)[];
  /** Tone data (sparse array - undefined = not loaded) */
  tones: (Tone | undefined)[];
  /** Track which patch banks have been loaded */
  loadedPatchBanks: number[];
  /** Track which tone banks have been loaded */
  loadedToneBanks: number[];
}

interface DeviceDataActions {
  // Device switching
  /** Set the current device type, clearing cache if it changed */
  setDeviceType: (deviceType: string) => void;

  // Patch operations
  setPatch: (index: number, patch: Patch, totalPatches: number) => void;
  setPatches: (patches: (Patch | undefined)[]) => void;
  markPatchBankLoaded: (bankIndex: number) => void;
  isPatchBankLoaded: (bankIndex: number) => boolean;
  invalidatePatchCache: () => void;

  // Tone operations
  setTone: (index: number, tone: Tone, totalTones: number) => void;
  setTones: (tones: (Tone | undefined)[]) => void;
  markToneBankLoaded: (bankIndex: number) => void;
  isToneBankLoaded: (bankIndex: number) => boolean;
  invalidateToneCache: () => void;

  // Bulk operations
  invalidateAllCache: () => void;

  // Ensure arrays are sized correctly (accepts size from config)
  ensurePatchArraySize: (totalPatches: number) => void;
  ensureToneArraySize: (totalTones: number) => void;
}

type DeviceDataStore = DeviceDataState & DeviceDataActions;

export const useDeviceDataStore = create<DeviceDataStore>((set, get) => ({
  // Initial state
  currentDeviceType: null,
  patches: [],
  tones: [],
  loadedPatchBanks: [],
  loadedToneBanks: [],

  // Device switching
  setDeviceType: (deviceType) => {
    const state = get();
    if (state.currentDeviceType === deviceType) return;

    // Clear cache when switching devices
    set({
      currentDeviceType: deviceType,
      patches: [],
      tones: [],
      loadedPatchBanks: [],
      loadedToneBanks: [],
    });
  },

  // Patch operations
  setPatch: (index, patch, totalPatches) =>
    set((state) => {
      const patches = [...state.patches];
      while (patches.length < totalPatches) patches.push(undefined);
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
  setTone: (index, tone, totalTones) =>
    set((state) => {
      const tones = [...state.tones];
      while (tones.length < totalTones) tones.push(undefined);
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
  ensurePatchArraySize: (totalPatches) =>
    set((state) => {
      if (state.patches.length >= totalPatches) return state;
      const patches = [...state.patches];
      while (patches.length < totalPatches) patches.push(undefined);
      return { patches };
    }),

  ensureToneArraySize: (totalTones) =>
    set((state) => {
      if (state.tones.length >= totalTones) return state;
      const tones = [...state.tones];
      while (tones.length < totalTones) tones.push(undefined);
      return { tones };
    }),
}));

// Helper selectors
export const selectLoadedPatches = (state: DeviceDataState) =>
  state.patches.filter((p): p is Patch => p !== undefined);

export const selectLoadedTones = (state: DeviceDataState) =>
  state.tones.filter((t): t is Tone => t !== undefined);
