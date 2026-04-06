/**
 * Library store — manages library tree data, device memory state, and transfer state.
 *
 * Holds the scanned tree data from sampler-library's filesystem scanners,
 * the selected library item, loading/error state, device program/sample
 * name lists, and transfer progress.
 */

import { create } from 'zustand';
import type { TreeNode } from '@audiocontrol/editor-core';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface LibraryStoreState {
  /** Scanned library tree nodes (samples, programs, etc.) */
  sampleNodes: TreeNode[];
  programNodes: TreeNode[];

  /** Currently selected tree node */
  selectedNode: TreeNode | null;

  /** Whether tree data is being loaded */
  loading: boolean;

  /** Error from the most recent scan/operation */
  error: string | null;

  // -- Device memory state --------------------------------------------------

  /** Program names currently resident in device memory */
  deviceProgramNames: string[];

  /** Sample names currently resident in device memory */
  deviceSampleNames: string[];

  /** Index of the selected device-side item (program or sample) */
  selectedDeviceIndex: number | null;

  /** Whether the selected device item is a program or sample */
  selectedDeviceType: 'program' | 'sample' | null;

  // -- Transfer state -------------------------------------------------------

  /** Whether a transfer (import/export) is currently in progress */
  transferInProgress: boolean;

  /** Transfer progress percentage (0-100), or null when not transferring */
  transferProgress: number | null;

  /** Error from the most recent transfer attempt */
  transferError: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface LibraryStoreActions {
  /** Replace sample tree data after a scan */
  setSampleNodes(nodes: TreeNode[]): void;

  /** Replace program tree data after a scan */
  setProgramNodes(nodes: TreeNode[]): void;

  /** Update the selected node */
  setSelectedNode(node: TreeNode | null): void;

  /** Set loading state */
  setLoading(loading: boolean): void;

  /** Set or clear the error */
  setError(error: string | null): void;

  /** Clear all tree data (e.g., on disconnect) */
  clear(): void;

  // -- Device memory actions ------------------------------------------------

  /** Replace the device program name list */
  setDeviceProgramNames(names: string[]): void;

  /** Replace the device sample name list */
  setDeviceSampleNames(names: string[]): void;

  /** Select a device-side item by type and index */
  setSelectedDevice(type: 'program' | 'sample', index: number): void;

  /** Clear the device-side selection */
  clearSelectedDevice(): void;

  // -- Transfer actions -----------------------------------------------------

  /** Set transfer progress (0-100) or null to clear */
  setTransferProgress(progress: number | null): void;

  /** Set or clear the transfer error */
  setTransferError(error: string | null): void;

  /** Reset all transfer state to idle */
  clearTransferState(): void;
}

export type LibraryStore = LibraryStoreState & LibraryStoreActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLibraryStore = create<LibraryStore>((set) => ({
  // Library state
  sampleNodes: [],
  programNodes: [],
  selectedNode: null,
  loading: false,
  error: null,

  // Device memory state
  deviceProgramNames: [],
  deviceSampleNames: [],
  selectedDeviceIndex: null,
  selectedDeviceType: null,

  // Transfer state
  transferInProgress: false,
  transferProgress: null,
  transferError: null,

  // -- Library actions ------------------------------------------------------

  setSampleNodes(nodes: TreeNode[]) {
    set({ sampleNodes: nodes });
  },

  setProgramNodes(nodes: TreeNode[]) {
    set({ programNodes: nodes });
  },

  setSelectedNode(node: TreeNode | null) {
    set({ selectedNode: node });
  },

  setLoading(loading: boolean) {
    set({ loading });
  },

  setError(error: string | null) {
    set({ error });
  },

  clear() {
    set({
      sampleNodes: [],
      programNodes: [],
      selectedNode: null,
      loading: false,
      error: null,
    });
  },

  // -- Device memory actions ------------------------------------------------

  setDeviceProgramNames(names: string[]) {
    set({ deviceProgramNames: names });
  },

  setDeviceSampleNames(names: string[]) {
    set({ deviceSampleNames: names });
  },

  setSelectedDevice(type: 'program' | 'sample', index: number) {
    set({ selectedDeviceType: type, selectedDeviceIndex: index });
  },

  clearSelectedDevice() {
    set({ selectedDeviceType: null, selectedDeviceIndex: null });
  },

  // -- Transfer actions -----------------------------------------------------

  setTransferProgress(progress: number | null) {
    set({
      transferInProgress: progress !== null,
      transferProgress: progress,
    });
  },

  setTransferError(error: string | null) {
    set({ transferError: error });
  },

  clearTransferState() {
    set({
      transferInProgress: false,
      transferProgress: null,
      transferError: null,
    });
  },
}));
