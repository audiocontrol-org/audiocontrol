import { create } from 'zustand';

/** A mapping from a MIDI CC number to a parameter update action. */
export interface CcMapping {
  cc: number;
  label: string;
  /** Min/max range the CC 0-127 maps to. */
  min: number;
  max: number;
  /** Called with the mapped value when the CC is received. */
  apply: (value: number) => void;
}

interface MidiLearnState {
  /** All active CC mappings. */
  mappings: CcMapping[];
  /** If non-null, the system is listening for the next CC to map. */
  learningTarget: { label: string; min: number; max: number; apply: (value: number) => void } | null;

  /** Start learning: next CC received will be mapped to this target. */
  startLearning: (target: Omit<CcMapping, 'cc'>) => void;
  /** Cancel learning mode. */
  cancelLearning: () => void;
  /** Complete learning: assign the received CC to the current target. */
  assignCc: (cc: number) => void;
  /** Remove a mapping by CC number. */
  removeMapping: (cc: number) => void;
  /** Process an incoming CC message. Returns true if handled. */
  handleCc: (cc: number, value: number) => boolean;
}

export const useMidiLearnStore = create<MidiLearnState>((set, get) => ({
  mappings: [],
  learningTarget: null,

  startLearning: (target) => set({ learningTarget: target }),
  cancelLearning: () => set({ learningTarget: null }),

  assignCc: (cc) => set((state) => {
    if (!state.learningTarget) return state;
    const { label, min, max, apply } = state.learningTarget;
    // Remove existing mapping for this CC
    const mappings = state.mappings.filter((m) => m.cc !== cc);
    mappings.push({ cc, label, min, max, apply });
    return { mappings, learningTarget: null };
  }),

  removeMapping: (cc) => set((state) => ({
    mappings: state.mappings.filter((m) => m.cc !== cc),
  })),

  handleCc: (cc, rawValue) => {
    const state = get();

    // If in learning mode, assign this CC
    if (state.learningTarget) {
      state.assignCc(cc);
      return true;
    }

    // Check if there's a mapping for this CC
    const mapping = state.mappings.find((m) => m.cc === cc);
    if (!mapping) return false;

    // Map 0-127 to min-max range
    const normalized = rawValue / 127;
    const mapped = mapping.min + normalized * (mapping.max - mapping.min);
    mapping.apply(mapped);
    return true;
  },
}));
