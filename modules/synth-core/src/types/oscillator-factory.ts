import type { SampleOscillator } from '@/types/sample-oscillator';

/** Creates oscillators from sample data. */
export interface OscillatorFactory {
  setBuffer(samples: Int16Array | Float32Array, sampleRate: number): void;
  setRootKey(rootKey: number): void;
  setLoopRegion(enabled: boolean, loopStart: number, loopEnd: number): void;
  createOscillator(note: number, velocity: number): SampleOscillator;
  /** Create an oscillator that plays a slice region of the buffer at original pitch. */
  createSliceOscillator(startSample: number, endSample: number, velocity: number): SampleOscillator;
  dispose(): void;
}
