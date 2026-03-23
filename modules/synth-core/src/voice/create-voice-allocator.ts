import type { OscillatorFactory } from '@/types/oscillator-factory';
import type { SampleOscillator } from '@/types/sample-oscillator';
import type { VoiceAllocator, VoiceAllocatorConfig } from '@/types/voice-allocator';

const DEFAULT_CONFIG: VoiceAllocatorConfig = {
  maxPolyphony: 16,
  retrigger: true,
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

  function stealOldest(): void {
    const firstKey = voices.keys().next().value;
    if (firstKey !== undefined) {
      voices.get(firstKey)?.stop(RETRIGGER_FADE_SEC);
      voices.delete(firstKey);
    }
  }

  return {
    noteOn(note: number, velocity: number): void {
      if (resolved.retrigger && voices.has(note)) {
        voices.get(note)?.stop(RETRIGGER_FADE_SEC);
        voices.delete(note);
      }

      if (voices.size >= resolved.maxPolyphony) {
        stealOldest();
      }

      const osc = factory.createOscillator(note, velocity);
      voices.set(note, osc);
    },

    noteOff(note: number): void {
      const osc = voices.get(note);
      if (osc) {
        osc.stop(RELEASE_FADE_SEC);
        voices.delete(note);
      }
    },

    stopAll(): void {
      for (const osc of voices.values()) {
        osc.stop(STOP_ALL_FADE_SEC);
      }
      voices.clear();
    },

    getActiveNotes(): Set<number> {
      return new Set(voices.keys());
    },

    dispose(): void {
      this.stopAll();
    },
  };
}
