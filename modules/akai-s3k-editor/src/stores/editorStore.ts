import { create } from 'zustand';
import {
  createEditorStoreSlice,
  type EditorStoreBase,
} from '@audiocontrol/editor-core';

const SESSION_KEY = 's3k-editor-selection';

interface PersistedSelection {
  programIndex: number | null;
  keygroupIndex: number | null;
}

function loadSelection(): PersistedSelection {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedSelection;
      return {
        programIndex: typeof parsed.programIndex === 'number' ? parsed.programIndex : null,
        keygroupIndex: typeof parsed.keygroupIndex === 'number' ? parsed.keygroupIndex : null,
      };
    }
  } catch { /* ignore */ }
  return { programIndex: null, keygroupIndex: null };
}

function saveSelection(programIndex: number | null, keygroupIndex: number | null): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ programIndex, keygroupIndex }));
  } catch { /* ignore */ }
}

export interface EditorStoreState extends EditorStoreBase {
  selectedProgramIndex: number | null;
  selectedKeygroupIndex: number | null;
}

export interface EditorStoreActions {
  selectProgram(index: number | null): void;
  selectKeygroup(index: number | null): void;
}

export type EditorStore = EditorStoreState & EditorStoreActions;

const initial = loadSelection();

export const useEditorStore = create<EditorStore>((set) => ({
  ...createEditorStoreSlice(set),

  selectedProgramIndex: initial.programIndex,
  selectedKeygroupIndex: initial.keygroupIndex,

  selectProgram(index: number | null) {
    saveSelection(index, null);
    set({ selectedProgramIndex: index, selectedKeygroupIndex: null, error: null });
  },

  selectKeygroup(index: number | null) {
    const programIndex = useEditorStore.getState().selectedProgramIndex;
    saveSelection(programIndex, index);
    set({ selectedKeygroupIndex: index, error: null });
  },
}));
