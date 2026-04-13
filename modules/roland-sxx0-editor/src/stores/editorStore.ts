/**
 * Zustand store for sampler editor UI state
 *
 * Device-agnostic store that manages UI state like selection and loading
 * indicators. Data caching is handled by the device client.
 */

import { create } from 'zustand';
import {
  createEditorStoreSlice,
  type EditorStoreBase,
} from '@audiocontrol/editor-core';

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

interface EditorState extends EditorStoreBase {
  // Selection state
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;

  // Extended progress tracking (device-specific)
  loadingCurrent: number;
  loadingTotal: number;

  // Hardware sync state
  hardwareChangeVersion: number;
  lastHardwareChange: LastHardwareChange;
}

interface EditorActions {
  // Selection
  selectPatch: (index: number | null) => void;
  selectTone: (index: number | null) => void;

  // Extended UI state
  clear: () => void;

  // Hardware sync
  notifyHardwareChange: (type: HardwareChangeType, index: number | null) => void;
  clearHardwareChange: () => void;
}

type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>((set) => {
  const baseSlice = createEditorStoreSlice(set);

  return {
    ...baseSlice,

    // Selection state
    selectedPatchIndex: null,
    selectedToneIndex: null,

    // Extended progress tracking
    loadingCurrent: 0,
    loadingTotal: 0,

    // Hardware sync state
    hardwareChangeVersion: 0,
    lastHardwareChange: { type: null, index: null, timestamp: 0 },

    selectPatch: (index) => set({ selectedPatchIndex: index }),

    selectTone: (index) => set({ selectedToneIndex: index }),

    // Override setProgress to also track current/total values
    setProgress: (current: number, total: number) => {
      set({
        loadingCurrent: current,
        loadingTotal: total,
        loadingProgress: total > 0 ? Math.round((current / total) * 100) : null,
      });
    },

    // Override clearProgress to also reset current/total values
    clearProgress: () => {
      set({
        loadingProgress: null,
        loadingCurrent: 0,
        loadingTotal: 0,
      });
    },

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
  };
});
