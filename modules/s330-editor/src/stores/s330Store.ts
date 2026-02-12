/**
 * Zustand store for S-330 UI state
 *
 * Data caching is handled by the S330 client - this store only manages
 * UI state like selection and loading indicators.
 */

import { create } from 'zustand';

/**
 * Type of hardware parameter change
 */
export type HardwareChangeType = 'patch' | 'tone' | 'function' | null;

/**
 * Information about the last hardware parameter change
 */
export interface LastHardwareChange {
  type: HardwareChangeType;
  index: number | null;
  timestamp: number;
}

interface S330State {
  // Selection state
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;

  // UI state
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;

  // Progress tracking
  loadingProgress: number | null; // 0-100, null when not tracking progress
  loadingCurrent: number;
  loadingTotal: number;

  // Hardware sync state
  // Incremented when any hardware parameter changes - triggers React re-renders
  hardwareChangeVersion: number;
  // Details of the last hardware change for selective refetching
  lastHardwareChange: LastHardwareChange;
}

interface S330Actions {
  // Selection
  selectPatch: (index: number | null) => void;
  selectTone: (index: number | null) => void;

  // UI state
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setError: (error: string | null) => void;
  setProgress: (current: number, total: number) => void;
  clearProgress: () => void;
  clear: () => void;

  // Hardware sync
  /**
   * Notify the store that a hardware parameter has changed.
   * This increments hardwareChangeVersion to trigger React re-renders
   * and stores the change details for selective refetching.
   */
  notifyHardwareChange: (type: HardwareChangeType, index: number | null) => void;

  /**
   * Clear the last hardware change after it's been handled.
   * This prevents the change from triggering multiple refetches.
   */
  clearHardwareChange: () => void;
}

type S330Store = S330State & S330Actions;

export const useS330Store = create<S330Store>((set) => ({
  // Initial state
  selectedPatchIndex: null,
  selectedToneIndex: null,
  isLoading: false,
  loadingMessage: null,
  error: null,
  loadingProgress: null,
  loadingCurrent: 0,
  loadingTotal: 0,
  hardwareChangeVersion: 0,
  lastHardwareChange: { type: null, index: null, timestamp: 0 },

  selectPatch: (index) => set({ selectedPatchIndex: index }),

  selectTone: (index) => set({ selectedToneIndex: index }),

  setLoading: (isLoading, message = null) =>
    set({ isLoading, loadingMessage: message }),

  setError: (error) => set({ error }),

  setProgress: (current, total) =>
    set({
      loadingCurrent: current,
      loadingTotal: total,
      loadingProgress: total > 0 ? Math.round((current / total) * 100) : null,
    }),

  clearProgress: () =>
    set({
      loadingProgress: null,
      loadingCurrent: 0,
      loadingTotal: 0,
    }),

  clear: () =>
    set({
      selectedPatchIndex: null,
      selectedToneIndex: null,
      error: null,
      loadingProgress: null,
      loadingCurrent: 0,
      loadingTotal: 0,
    }),

  notifyHardwareChange: (type, index) =>
    set((state) => ({
      hardwareChangeVersion: state.hardwareChangeVersion + 1,
      lastHardwareChange: {
        type,
        index,
        timestamp: Date.now(),
      },
    })),

  clearHardwareChange: () =>
    set({
      lastHardwareChange: { type: null, index: null, timestamp: 0 },
    }),
}));
