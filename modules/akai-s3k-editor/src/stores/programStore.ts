import { create } from 'zustand';
import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';

export interface ProgramStoreState {
  /** Sparse array of loaded program headers, indexed by program number (0-127) */
  programs: (ProgramHeader | undefined)[];
  /** List of all resident program names fetched from the device */
  programNames: string[];
  /** Whether the program name list has been loaded from the device */
  namesLoaded: boolean;
}

export interface ProgramStoreActions {
  /** Replace the full program names list */
  setProgramNames(names: string[]): void;
  /** Store a single program header at the given index */
  setProgram(index: number, header: ProgramHeader): void;
  /** Clear all cached program data */
  invalidateCache(): void;
}

export type ProgramStore = ProgramStoreState & ProgramStoreActions;

function createEmptyPrograms(): (ProgramHeader | undefined)[] {
  return new Array<ProgramHeader | undefined>(128).fill(undefined);
}

export const useProgramStore = create<ProgramStore>((set) => ({
  programs: createEmptyPrograms(),
  programNames: [],
  namesLoaded: false,

  setProgramNames(names: string[]) {
    set({ programNames: names, namesLoaded: true });
  },

  setProgram(index: number, header: ProgramHeader) {
    set((state) => {
      const next = [...state.programs];
      next[index] = header;
      return { programs: next };
    });
  },

  invalidateCache() {
    set({
      programs: createEmptyPrograms(),
      programNames: [],
      namesLoaded: false,
    });
  },
}));

// Expose on window for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__programStore = useProgramStore;
}
