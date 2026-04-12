import { create } from 'zustand';

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

export interface EditorStoreState {
  selectedProgramIndex: number | null;
  selectedKeygroupIndex: number | null;
  isLoading: boolean;
  loadingMessage: string | null;
  loadingProgress: number | null;
  error: string | null;
}

export interface EditorStoreActions {
  selectProgram(index: number | null): void;
  selectKeygroup(index: number | null): void;
  setLoading(isLoading: boolean, message?: string): void;
  setProgress(current: number, total: number): void;
  clearProgress(): void;
  setError(error: string | null): void;
}

export type EditorStore = EditorStoreState & EditorStoreActions;

const initial = loadSelection();

export const useEditorStore = create<EditorStore>((set) => ({
  selectedProgramIndex: initial.programIndex,
  selectedKeygroupIndex: initial.keygroupIndex,
  isLoading: false,
  loadingMessage: null,
  loadingProgress: null,
  error: null,

  selectProgram(index: number | null) {
    saveSelection(index, null);
    set({ selectedProgramIndex: index, selectedKeygroupIndex: null, error: null });
  },

  selectKeygroup(index: number | null) {
    const programIndex = useEditorStore.getState().selectedProgramIndex;
    saveSelection(programIndex, index);
    set({ selectedKeygroupIndex: index, error: null });
  },

  setLoading(isLoading: boolean, message?: string) {
    set({
      isLoading,
      loadingMessage: message ?? null,
      ...(isLoading ? {} : { loadingProgress: null }),
    });
  },

  setProgress(current: number, total: number) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    set({ loadingProgress: percentage });
  },

  clearProgress() {
    set({ loadingProgress: null });
  },

  setError(error: string | null) {
    set({ error, isLoading: false, loadingMessage: null, loadingProgress: null });
  },
}));
