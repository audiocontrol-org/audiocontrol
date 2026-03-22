export { createMockOscillatorFactory } from '@/testing/mock-oscillator-factory';
export type { MockSampleOscillator, MockOscillatorFactoryControls } from '@/testing/mock-oscillator-factory';

export { createMockNoteInput } from '@/testing/mock-note-input';
export type { MockNoteInputControls } from '@/testing/mock-note-input';

export {
  generateSineInt16,
  generateSineWaveInt16,
  estimateFrequencyZeroCrossing,
  measureRMS,
  renderAndGetSamples,
  measureLoopCorrelation,
} from '@/testing/audio-helpers';
