/**
 * Shared editor store base state and actions for loading, progress, and error tracking.
 *
 * Both the S3K and Roland editors share these fields and behaviors. This module
 * provides the interface and a Zustand slice creator so each editor composes
 * the base into its own store without duplicating logic.
 *
 * Usage with Zustand's create():
 *
 *   const useEditorStore = create<MyState & EditorStoreBase>((set) => ({
 *     ...createEditorStoreSlice(set),
 *     // device-specific state and actions
 *   }));
 */

/**
 * Shared state fields present in every editor store.
 */
export interface EditorStoreBaseState {
  isLoading: boolean;
  loadingMessage: string | null;
  loadingProgress: number | null;
  error: string | null;
}

/**
 * Shared actions present in every editor store.
 */
export interface EditorStoreBaseActions {
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setProgress: (current: number, total: number) => void;
  clearProgress: () => void;
  setError: (error: string | null) => void;
}

/**
 * Combined base type for editor stores.
 */
export type EditorStoreBase = EditorStoreBaseState & EditorStoreBaseActions;

/**
 * Initial state values for the editor store base.
 */
export const editorStoreBaseInitialState: EditorStoreBaseState = {
  isLoading: false,
  loadingMessage: null,
  loadingProgress: null,
  error: null,
};

/**
 * Creates the base slice of state and actions for an editor store.
 *
 * The returned object can be spread into a Zustand `create()` call alongside
 * device-specific state. Actions use the provided `set` function so they
 * participate in the same store instance.
 *
 * @param set - The Zustand `set` function from the enclosing `create()` call.
 */
export function createEditorStoreSlice(
  set: (partial: Partial<EditorStoreBase>) => void,
): EditorStoreBase {
  return {
    ...editorStoreBaseInitialState,

    setLoading(isLoading: boolean, message?: string | null) {
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
      set({
        error,
        isLoading: false,
        loadingMessage: null,
        loadingProgress: null,
      });
    },
  };
}
