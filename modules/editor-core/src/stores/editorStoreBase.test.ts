import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import {
  createEditorStoreSlice,
  editorStoreBaseInitialState,
  type EditorStoreBase,
} from '@/stores/editorStoreBase';

function createTestStore() {
  return create<EditorStoreBase>((set) => ({
    ...createEditorStoreSlice(set),
  }));
}

describe('createEditorStoreSlice', () => {
  it('initializes with default state', () => {
    const store = createTestStore();
    const state = store.getState();
    expect(state.isLoading).toBe(false);
    expect(state.loadingMessage).toBeNull();
    expect(state.loadingProgress).toBeNull();
    expect(state.error).toBeNull();
  });

  it('exports initial state constant matching defaults', () => {
    expect(editorStoreBaseInitialState).toEqual({
      isLoading: false,
      loadingMessage: null,
      loadingProgress: null,
      error: null,
    });
  });

  describe('setLoading', () => {
    it('sets loading true with message', () => {
      const store = createTestStore();
      store.getState().setLoading(true, 'Fetching data...');
      const state = store.getState();
      expect(state.isLoading).toBe(true);
      expect(state.loadingMessage).toBe('Fetching data...');
    });

    it('sets loading true without message', () => {
      const store = createTestStore();
      store.getState().setLoading(true);
      const state = store.getState();
      expect(state.isLoading).toBe(true);
      expect(state.loadingMessage).toBeNull();
    });

    it('clears progress when loading is set to false', () => {
      const store = createTestStore();
      store.getState().setLoading(true, 'Loading...');
      store.getState().setProgress(50, 100);
      expect(store.getState().loadingProgress).toBe(50);

      store.getState().setLoading(false);
      const state = store.getState();
      expect(state.isLoading).toBe(false);
      expect(state.loadingMessage).toBeNull();
      expect(state.loadingProgress).toBeNull();
    });

    it('preserves progress when loading remains true', () => {
      const store = createTestStore();
      store.getState().setLoading(true, 'Step 1');
      store.getState().setProgress(25, 100);
      store.getState().setLoading(true, 'Step 2');

      const state = store.getState();
      expect(state.isLoading).toBe(true);
      expect(state.loadingMessage).toBe('Step 2');
      expect(state.loadingProgress).toBe(25);
    });
  });

  describe('setProgress', () => {
    it('computes percentage from current and total', () => {
      const store = createTestStore();
      store.getState().setProgress(30, 100);
      expect(store.getState().loadingProgress).toBe(30);
    });

    it('rounds percentage to nearest integer', () => {
      const store = createTestStore();
      store.getState().setProgress(1, 3);
      expect(store.getState().loadingProgress).toBe(33);
    });

    it('returns 0 when total is 0', () => {
      const store = createTestStore();
      store.getState().setProgress(0, 0);
      expect(store.getState().loadingProgress).toBe(0);
    });
  });

  describe('clearProgress', () => {
    it('resets progress to null', () => {
      const store = createTestStore();
      store.getState().setProgress(50, 100);
      expect(store.getState().loadingProgress).toBe(50);

      store.getState().clearProgress();
      expect(store.getState().loadingProgress).toBeNull();
    });
  });

  describe('setError', () => {
    it('sets error and clears loading state', () => {
      const store = createTestStore();
      store.getState().setLoading(true, 'Working...');
      store.getState().setProgress(75, 100);

      store.getState().setError('Something went wrong');
      const state = store.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.isLoading).toBe(false);
      expect(state.loadingMessage).toBeNull();
      expect(state.loadingProgress).toBeNull();
    });

    it('clears error when set to null', () => {
      const store = createTestStore();
      store.getState().setError('An error');
      expect(store.getState().error).toBe('An error');

      store.getState().setError(null);
      expect(store.getState().error).toBeNull();
    });
  });

  describe('composition with device-specific state', () => {
    interface DeviceStore extends EditorStoreBase {
      selectedItem: number | null;
      selectItem: (index: number | null) => void;
    }

    it('works when composed into a larger store', () => {
      const store = create<DeviceStore>((set) => ({
        ...createEditorStoreSlice(set),
        selectedItem: null,
        selectItem: (index) => set({ selectedItem: index }),
      }));

      store.getState().selectItem(5);
      expect(store.getState().selectedItem).toBe(5);

      store.getState().setLoading(true, 'Loading item...');
      expect(store.getState().isLoading).toBe(true);
      expect(store.getState().selectedItem).toBe(5);
    });
  });
});
