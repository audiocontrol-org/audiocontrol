import { useMemo } from 'react';
import type { ProgramPlayback } from '@audiocontrol/synth-core';
import { DEFAULT_AMP_ENVELOPE } from '@audiocontrol/synth-core';

/**
 * Generate a single-cycle sine wave sample buffer.
 * When played at different rates by the engine, this produces pitched sine tones.
 */
function generateSineWave(sampleRate: number, durationSec: number): Float32Array {
  const length = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(length);
  const frequency = 261.63; // C4

  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }

  return buffer;
}

/**
 * Returns a demo program with a single zone covering the full keyboard.
 * Uses a generated sine wave — no sample files needed.
 */
export function useDemoProgram(): ProgramPlayback {
  return useMemo(() => {
    const sampleRate = 44100;
    const samples = generateSineWave(sampleRate, 2);

    return {
      name: 'Demo Sine',
      zones: [
        {
          samples,
          sampleRate,
          keyRange: [0, 127] as [number, number],
          velocityRange: [1, 127] as [number, number],
          pitch: { rootKey: 60, transpose: 0, fineTune: 0 },
          ampEnvelope: { ...DEFAULT_AMP_ENVELOPE, attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.3 },
          muteGroup: 0,
          label: 'Sine',
        },
      ],
      polyphony: 'poly',
      playbackMode: 'gate',
      maxVoices: 16,
    };
  }, []);
}
