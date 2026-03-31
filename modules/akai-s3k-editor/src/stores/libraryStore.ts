/**
 * Library store — manages library tree data and selection state.
 *
 * Holds the scanned tree data from sampler-library's filesystem scanners,
 * the selected library item, and loading/error state. The tree data is
 * stored as editor-core TreeNodes after conversion from LibraryTreeNodes.
 */

import { create } from 'zustand';
import type { TreeNode } from '@audiocontrol/editor-core';

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
}

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
}

export type LibraryStore = LibraryStoreState & LibraryStoreActions;

export const useLibraryStore = create<LibraryStore>((set) => ({
  sampleNodes: [],
  programNodes: [],
  selectedNode: null,
  loading: false,
  error: null,

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
}));
