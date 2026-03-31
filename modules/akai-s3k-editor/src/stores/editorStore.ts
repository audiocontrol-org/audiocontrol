import { create } from 'zustand';

export interface EditorStoreState {
  /** Index of the currently selected program, or null if none selected */
  selectedProgramIndex: number | null;
  /** Whether a loading operation is in progress */
  isLoading: boolean;
  /** Human-readable message describing the current loading operation */
  loadingMessage: string | null;
  /** Loading progress percentage (0-100), or null when indeterminate */
  loadingProgress: number | null;
  /** Error message from the most recent failed operation, or null */
  error: string | null;
}

export interface EditorStoreActions {
  /** Select a program by index, or deselect with null */
  selectProgram(index: number | null): void;
  /** Set loading state with an optional message */
  setLoading(isLoading: boolean, message?: string): void;
  /** Update progress based on current item and total count */
  setProgress(current: number, total: number): void;
  /** Clear progress indicator */
  clearProgress(): void;
  /** Set or clear the error message */
  setError(error: string | null): void;
}

export type EditorStore = EditorStoreState & EditorStoreActions;

export const useEditorStore = create<EditorStore>((set) => ({
  selectedProgramIndex: null,
  isLoading: false,
  loadingMessage: null,
  loadingProgress: null,
  error: null,

  selectProgram(index: number | null) {
    set({ selectedProgramIndex: index, error: null });
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
