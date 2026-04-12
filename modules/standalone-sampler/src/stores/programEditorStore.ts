import { create } from 'zustand';
import type {
  ProgramPlayback,
  ZonePlayback,
  AmpEnvelopeParams,
  FilterParams,
  PitchParams,
} from '@audiocontrol/synth-core';
import { DEFAULT_AMP_ENVELOPE, DEFAULT_PITCH_PARAMS } from '@audiocontrol/synth-core';

interface ProgramEditorState {
  /** The program currently being edited. Null if no program loaded. */
  program: ProgramPlayback | null;
  /** Index of the currently selected zone for editing. */
  selectedZoneIndex: number;
  /** Whether the program has unsaved changes. */
  dirty: boolean;

  // --- Actions ---

  /** Load a program into the editor. */
  loadProgram: (program: ProgramPlayback) => void;
  /** Clear the editor. */
  clearProgram: () => void;
  /** Select a zone by index. */
  selectZone: (index: number) => void;

  // Zone CRUD
  /** Add a new zone with default parameters. */
  addZone: (samples: Int16Array | Float32Array, sampleRate: number, label?: string) => void;
  /** Remove a zone by index. */
  removeZone: (index: number) => void;
  /** Move a zone from one index to another. */
  moveZone: (fromIndex: number, toIndex: number) => void;

  // Zone parameter updates
  updateZonePitch: (index: number, pitch: Partial<PitchParams>) => void;
  updateZoneAmpEnvelope: (index: number, envelope: Partial<AmpEnvelopeParams>) => void;
  updateZoneFilter: (index: number, filter: FilterParams | undefined) => void;
  updateZoneKeyRange: (index: number, keyRange: [number, number]) => void;
  updateZoneVelocityRange: (index: number, velocityRange: [number, number]) => void;
  updateZoneMuteGroup: (index: number, muteGroup: number) => void;
  updateZoneLabel: (index: number, label: string) => void;

  // Program-level updates
  updateProgramName: (name: string) => void;
  updatePolyphony: (polyphony: 'mono' | 'poly') => void;
  updatePlaybackMode: (mode: 'one-shot' | 'gate') => void;
  updateMaxVoices: (maxVoices: number) => void;
}

function updateZone(
  program: ProgramPlayback,
  index: number,
  updater: (zone: ZonePlayback) => ZonePlayback,
): ProgramPlayback {
  const zones = [...program.zones];
  const zone = zones[index];
  if (!zone) return program;
  zones[index] = updater(zone);
  return { ...program, zones };
}

function createDefaultZone(
  samples: Int16Array | Float32Array,
  sampleRate: number,
  label?: string,
): ZonePlayback {
  return {
    samples,
    sampleRate,
    keyRange: [0, 127],
    velocityRange: [1, 127],
    pitch: { ...DEFAULT_PITCH_PARAMS },
    ampEnvelope: { ...DEFAULT_AMP_ENVELOPE },
    muteGroup: 0,
    label,
  };
}

export const useProgramEditorStore = create<ProgramEditorState>((set) => ({
  program: null,
  selectedZoneIndex: 0,
  dirty: false,

  loadProgram: (program) => set({ program, selectedZoneIndex: 0, dirty: false }),
  clearProgram: () => set({ program: null, selectedZoneIndex: 0, dirty: false }),
  selectZone: (index) => set({ selectedZoneIndex: index }),

  addZone: (samples, sampleRate, label) => set((state) => {
    if (!state.program) return state;
    const newZone = createDefaultZone(samples, sampleRate, label);
    const zones = [...state.program.zones, newZone];
    return {
      program: { ...state.program, zones },
      selectedZoneIndex: zones.length - 1,
      dirty: true,
    };
  }),

  removeZone: (index) => set((state) => {
    if (!state.program || state.program.zones.length <= 1) return state;
    const zones = state.program.zones.filter((_, i) => i !== index);
    const selectedZoneIndex = Math.min(state.selectedZoneIndex, zones.length - 1);
    return {
      program: { ...state.program, zones },
      selectedZoneIndex,
      dirty: true,
    };
  }),

  moveZone: (fromIndex, toIndex) => set((state) => {
    if (!state.program) return state;
    const zones = [...state.program.zones];
    const [moved] = zones.splice(fromIndex, 1);
    if (!moved) return state;
    zones.splice(toIndex, 0, moved);
    return {
      program: { ...state.program, zones },
      selectedZoneIndex: toIndex,
      dirty: true,
    };
  }),

  updateZonePitch: (index, pitch) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({
        ...z,
        pitch: { ...z.pitch, ...pitch },
      })),
      dirty: true,
    };
  }),

  updateZoneAmpEnvelope: (index, envelope) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({
        ...z,
        ampEnvelope: { ...z.ampEnvelope, ...envelope },
      })),
      dirty: true,
    };
  }),

  updateZoneFilter: (index, filter) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({
        ...z,
        filter,
      })),
      dirty: true,
    };
  }),

  updateZoneKeyRange: (index, keyRange) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({ ...z, keyRange })),
      dirty: true,
    };
  }),

  updateZoneVelocityRange: (index, velocityRange) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({ ...z, velocityRange })),
      dirty: true,
    };
  }),

  updateZoneMuteGroup: (index, muteGroup) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({ ...z, muteGroup })),
      dirty: true,
    };
  }),

  updateZoneLabel: (index, label) => set((state) => {
    if (!state.program) return state;
    return {
      program: updateZone(state.program, index, (z) => ({ ...z, label })),
      dirty: true,
    };
  }),

  updateProgramName: (name) => set((state) => {
    if (!state.program) return state;
    return { program: { ...state.program, name }, dirty: true };
  }),

  updatePolyphony: (polyphony) => set((state) => {
    if (!state.program) return state;
    return { program: { ...state.program, polyphony }, dirty: true };
  }),

  updatePlaybackMode: (mode) => set((state) => {
    if (!state.program) return state;
    return { program: { ...state.program, playbackMode: mode }, dirty: true };
  }),

  updateMaxVoices: (maxVoices) => set((state) => {
    if (!state.program) return state;
    return { program: { ...state.program, maxVoices }, dirty: true };
  }),
}));
