import type { OscillatorFactory } from '@/types/oscillator-factory';
import type { SampleOscillator } from '@/types/sample-oscillator';
import type { VoiceAllocator, VoiceAllocatorConfig } from '@/types/voice-allocator';

const DEFAULT_CONFIG: VoiceAllocatorConfig = {
  maxPolyphony: 16,
  retrigger: true,
  playbackMode: 'gate',
};

const RETRIGGER_FADE_SEC = 0.005;
const RELEASE_FADE_SEC = 0.02;
const STOP_ALL_FADE_SEC = 0.01;

export function createVoiceAllocator(
  factory: OscillatorFactory,
  config?: Partial<VoiceAllocatorConfig>,
): VoiceAllocator {
  const resolved: VoiceAllocatorConfig = { ...DEFAULT_CONFIG, ...config };
  const voices = new Map<number, SampleOscillator>();
  const sliceVoices = new Map<number, SampleOscillator>();

  function totalActive(): number {
    return voices.size + sliceVoices.size;
  }

  function stealOldestNote(): void {
    const firstKey = voices.keys().next().value;
    if (firstKey !== undefined) {
      voices.get(firstKey)?.stop(RETRIGGER_FADE_SEC);
      voices.delete(firstKey);
    }
  }

  function stealOldestSlice(): void {
    const firstKey = sliceVoices.keys().next().value;
    if (firstKey !== undefined) {
      sliceVoices.get(firstKey)?.stop(RETRIGGER_FADE_SEC);
      sliceVoices.delete(firstKey);
    }
  }

  function stealOldestAny(): void {
    // Steal from whichever map has entries, preferring notes
    if (voices.size > 0) {
      stealOldestNote();
    } else {
      stealOldestSlice();
    }
  }

  function stopSlicesInMuteGroup(group: number, excludeIndex: number): void {
    if (!resolved.muteGroups || group === 0) return;

    for (const [idx, osc] of sliceVoices) {
      if (idx === excludeIndex) continue;
      const sliceMuteGroup = resolved.muteGroups[idx] ?? 0;
      if (sliceMuteGroup === group) {
        osc.stop(RETRIGGER_FADE_SEC);
        sliceVoices.delete(idx);
      }
    }
  }

  return {
    noteOn(note: number, velocity: number): void {
      if (resolved.retrigger && voices.has(note)) {
        voices.get(note)?.stop(RETRIGGER_FADE_SEC);
        voices.delete(note);
      }

      if (totalActive() >= resolved.maxPolyphony) {
        stealOldestAny();
      }

      const osc = factory.createOscillator(note, velocity);
      voices.set(note, osc);
    },

    noteOff(note: number): void {
      if (resolved.playbackMode === 'one-shot') return;

      const osc = voices.get(note);
      if (osc) {
        osc.stop(RELEASE_FADE_SEC);
        voices.delete(note);
      }
    },

    sliceOn(sliceIndex: number, startSample: number, endSample: number, velocity: number): void {
      if (resolved.retrigger && sliceVoices.has(sliceIndex)) {
        sliceVoices.get(sliceIndex)?.stop(RETRIGGER_FADE_SEC);
        sliceVoices.delete(sliceIndex);
      }

      // Enforce mute groups
      const muteGroup = resolved.muteGroups?.[sliceIndex] ?? 0;
      if (muteGroup !== 0) {
        stopSlicesInMuteGroup(muteGroup, sliceIndex);
      }

      if (totalActive() >= resolved.maxPolyphony) {
        stealOldestAny();
      }

      const osc = factory.createSliceOscillator(startSample, endSample, velocity);
      sliceVoices.set(sliceIndex, osc);
    },

    sliceOff(sliceIndex: number): void {
      if (resolved.playbackMode === 'one-shot') return;

      const osc = sliceVoices.get(sliceIndex);
      if (osc) {
        osc.stop(RELEASE_FADE_SEC);
        sliceVoices.delete(sliceIndex);
      }
    },

    stopAll(): void {
      for (const osc of voices.values()) {
        osc.stop(STOP_ALL_FADE_SEC);
      }
      voices.clear();

      for (const osc of sliceVoices.values()) {
        osc.stop(STOP_ALL_FADE_SEC);
      }
      sliceVoices.clear();
    },

    getActiveNotes(): Set<number> {
      return new Set(voices.keys());
    },

    getActiveSlices(): Set<number> {
      return new Set(sliceVoices.keys());
    },

    dispose(): void {
      this.stopAll();
    },
  };
}
