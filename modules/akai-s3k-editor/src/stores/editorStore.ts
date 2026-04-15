import { create } from 'zustand';
import {
  createEditorStoreSlice,
  type EditorStoreBase,
} from '@audiocontrol/editor-core';

const SESSION_KEY = 's3k-editor-selection';

interface PersistedSelection {
  programIndex: number | null;
  keygroupIndex: number | null;
  sampleIndex: number | null;
}

function loadSelection(): PersistedSelection {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedSelection;
      return {
        programIndex: typeof parsed.programIndex === 'number' ? parsed.programIndex : null,
        keygroupIndex: typeof parsed.keygroupIndex === 'number' ? parsed.keygroupIndex : null,
        sampleIndex: typeof parsed.sampleIndex === 'number' ? parsed.sampleIndex : null,
      };
    }
  } catch { /* ignore */ }
  return { programIndex: null, keygroupIndex: null, sampleIndex: null };
}

function saveSelection(sel: Partial<PersistedSelection>): void {
  try {
    const current = loadSelection();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...sel }));
  } catch { /* ignore */ }
}

export interface EditorStoreState extends EditorStoreBase {
  selectedProgramIndex: number | null;
  selectedKeygroupIndex: number | null;
  selectedSampleIndex: number | null;
}

export interface EditorStoreActions {
  selectProgram(index: number | null): void;
  selectKeygroup(index: number | null): void;
  selectSample(index: number | null): void;
}

export type EditorStore = EditorStoreState & EditorStoreActions;

const initial = loadSelection();

export const useEditorStore = create<EditorStore>((set) => ({
  ...createEditorStoreSlice(set),

  selectedProgramIndex: initial.programIndex,
  selectedKeygroupIndex: initial.keygroupIndex,
  selectedSampleIndex: initial.sampleIndex,

  selectProgram(index: number | null) {
    saveSelection({ programIndex: index, keygroupIndex: null });
    set({ selectedProgramIndex: index, selectedKeygroupIndex: null, error: null });
  },

  selectKeygroup(index: number | null) {
    saveSelection({ keygroupIndex: index });
    set({ selectedKeygroupIndex: index, error: null });
  },

  selectSample(index: number | null) {
    saveSelection({ sampleIndex: index });
    set({ selectedSampleIndex: index, error: null });
  },
}));
