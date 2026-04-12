import type { ProgramPlayback } from '@/types/program-playback';
import type { EffectsChainParams } from '@/types/effects';
import type { ProgramEngine } from '@/program/create-program-engine';
import { createProgramEngine } from '@/program/create-program-engine';
import type { EffectsChain } from '@/program/effects-chain';
import { createEffectsChain } from '@/program/effects-chain';
import { DEFAULT_EFFECTS } from '@/types/effects';

/** A channel slot in the multi-timbral engine. */
export interface ChannelSlot {
  channel: number;
  program: ProgramPlayback;
}

/** Multi-timbral engine: multiple programs on different MIDI channels. */
export interface MultiTimbralEngine {
  /** Set a program on a MIDI channel (0-15). */
  setChannel(channel: number, program: ProgramPlayback): void;
  /** Remove the program from a channel. */
  clearChannel(channel: number): void;
  /** Route a note-on to the correct channel's engine. */
  noteOn(channel: number, note: number, velocity: number): void;
  /** Route a note-off to the correct channel's engine. */
  noteOff(channel: number, note: number): void;
  /** Stop all voices on all channels. */
  stopAll(): void;
  /** Get active notes across all channels. */
  getActiveNotes(): Set<number>;
  /** Update effects for all channels. */
  updateEffects(params: EffectsChainParams): void;
  /** Clean up. */
  dispose(): void;
}

interface ChannelState {
  engine: ProgramEngine;
  effects: EffectsChain;
}

export function createMultiTimbralEngine(
  ctx: AudioContext,
  effects?: EffectsChainParams,
): MultiTimbralEngine {
  const channels = new Map<number, ChannelState>();
  let currentEffects = effects ?? DEFAULT_EFFECTS;

  return {
    setChannel(channel: number, program: ProgramPlayback): void {
      // Clean up existing channel
      const existing = channels.get(channel);
      if (existing) {
        existing.engine.dispose();
        existing.effects.dispose();
      }

      const chain = createEffectsChain(ctx, currentEffects);
      const engine = createProgramEngine(ctx, program, chain.input);
      channels.set(channel, { engine, effects: chain });
    },

    clearChannel(channel: number): void {
      const existing = channels.get(channel);
      if (existing) {
        existing.engine.dispose();
        existing.effects.dispose();
        channels.delete(channel);
      }
    },

    noteOn(channel: number, note: number, velocity: number): void {
      channels.get(channel)?.engine.noteOn(note, velocity);
    },

    noteOff(channel: number, note: number): void {
      channels.get(channel)?.engine.noteOff(note);
    },

    stopAll(): void {
      for (const state of channels.values()) {
        state.engine.stopAll();
      }
    },

    getActiveNotes(): Set<number> {
      const all = new Set<number>();
      for (const state of channels.values()) {
        for (const note of state.engine.getActiveNotes()) {
          all.add(note);
        }
      }
      return all;
    },

    updateEffects(params: EffectsChainParams): void {
      currentEffects = params;
      for (const state of channels.values()) {
        state.effects.update(params);
      }
    },

    dispose(): void {
      for (const state of channels.values()) {
        state.engine.dispose();
        state.effects.dispose();
      }
      channels.clear();
    },
  };
}
