import { create } from 'zustand';
import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';

export interface SampleStoreState {
  /** Sample names from the device */
  sampleNames: string[];
  /** Whether names have been loaded */
  namesLoaded: boolean;
  /** Sparse array of loaded sample headers, indexed by sample number */
  samples: (SampleHeader | undefined)[];
}

export interface SampleStoreActions {
  /** Store sample names */
  setSampleNames(names: string[]): void;
  /** Store a single sample header at the given index */
  setSample(index: number, header: SampleHeader): void;
  /** Clear all cached sample data */
  invalidateCache(): void;
}

export type SampleStore = SampleStoreState & SampleStoreActions;

export const useSampleStore = create<SampleStore>((set) => ({
  sampleNames: [],
  namesLoaded: false,
  samples: [],

  setSampleNames(names: string[]) {
    set({ sampleNames: names, namesLoaded: true });
  },

  setSample(index: number, header: SampleHeader) {
    set((state) => {
      const next = [...state.samples];
      next[index] = header;
      return { samples: next };
    });
  },

  invalidateCache() {
    set({ sampleNames: [], namesLoaded: false, samples: [] });
  },
}));
