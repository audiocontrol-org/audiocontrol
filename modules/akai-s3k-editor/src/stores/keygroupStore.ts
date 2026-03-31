import { create } from 'zustand';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

export interface KeygroupStoreState {
  /** Sparse array of loaded keygroup headers, indexed by keygroup number */
  keygroups: (KeygroupHeader | undefined)[];
  /** Number of keygroups in the currently selected program */
  keygroupCount: number;
}

export interface KeygroupStoreActions {
  /** Store a single keygroup header at the given index */
  setKeygroup(index: number, header: KeygroupHeader): void;
  /** Set the expected keygroup count for the current program */
  setKeygroupCount(count: number): void;
  /** Clear all cached keygroup data */
  invalidateCache(): void;
}

export type KeygroupStore = KeygroupStoreState & KeygroupStoreActions;

export const useKeygroupStore = create<KeygroupStore>((set) => ({
  keygroups: [],
  keygroupCount: 0,

  setKeygroup(index: number, header: KeygroupHeader) {
    set((state) => {
      const next = [...state.keygroups];
      next[index] = header;
      return { keygroups: next };
    });
  },

  setKeygroupCount(count: number) {
    set({ keygroupCount: count, keygroups: new Array(count).fill(undefined) });
  },

  invalidateCache() {
    set({ keygroups: [], keygroupCount: 0 });
  },
}));
