import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';

export interface SampleStoreState {
  /** Sample names from the device */
  sampleNames: string[];
  /** Whether names have been loaded */
  namesLoaded: boolean;
  /** Sparse array of loaded sample headers, indexed by sample number */
  samples: (SampleHeader | undefined)[];
  /** Timestamp (ms) when names were last fetched from device */
  lastRefreshed: number | null;
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

export const useSampleStore = create<SampleStore>()(
  persist(
    (set) => ({
      sampleNames: [],
      namesLoaded: false,
      samples: [],
      lastRefreshed: null,

      setSampleNames(names: string[]) {
        set({ sampleNames: names, namesLoaded: true, lastRefreshed: Date.now() });
      },

      setSample(index: number, header: SampleHeader) {
        set((state) => {
          const next = [...state.samples];
          next[index] = header;
          return { samples: next };
        });
      },

      invalidateCache() {
        set({ sampleNames: [], namesLoaded: false, samples: [], lastRefreshed: null });
      },
    }),
    {
      name: 's3k-sample-cache',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
