import { create } from 'zustand';
import type { EffectsChainParams, ReverbParams, DelayParams, ChorusParams } from '@audiocontrol/synth-core';
import { DEFAULT_EFFECTS } from '@audiocontrol/synth-core';

interface EffectsStoreState {
  effects: EffectsChainParams;
  updateReverb: (params: Partial<ReverbParams>) => void;
  updateDelay: (params: Partial<DelayParams>) => void;
  updateChorus: (params: Partial<ChorusParams>) => void;
}

export const useEffectsStore = create<EffectsStoreState>((set) => ({
  effects: DEFAULT_EFFECTS,

  updateReverb: (params) => set((state) => ({
    effects: {
      ...state.effects,
      reverb: { ...state.effects.reverb, ...params },
    },
  })),

  updateDelay: (params) => set((state) => ({
    effects: {
      ...state.effects,
      delay: { ...state.effects.delay, ...params },
    },
  })),

  updateChorus: (params) => set((state) => ({
    effects: {
      ...state.effects,
      chorus: { ...state.effects.chorus, ...params },
    },
  })),
}));
