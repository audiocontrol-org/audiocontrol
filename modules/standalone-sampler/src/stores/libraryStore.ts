import { create } from 'zustand';
import type { TreeNode } from '@audiocontrol/editor-core';

interface LibraryStoreState {
  sampleNodes: TreeNode[];
  programNodes: TreeNode[];
  loading: boolean;
  error: string | null;
  setSampleNodes: (nodes: TreeNode[]) => void;
  setProgramNodes: (nodes: TreeNode[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useLibraryStore = create<LibraryStoreState>((set) => ({
  sampleNodes: [],
  programNodes: [],
  loading: false,
  error: null,
  setSampleNodes: (nodes) => set({ sampleNodes: nodes }),
  setProgramNodes: (nodes) => set({ programNodes: nodes }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () => set({ sampleNodes: [], programNodes: [], loading: false, error: null }),
}));
