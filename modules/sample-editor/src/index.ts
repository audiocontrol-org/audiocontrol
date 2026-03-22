export type { SampleOperation, FadeCurve, HistoryEntry } from '@/types';

export { trimSamples, trimSilence } from '@/operations/trim';
export { normalize, applyGain } from '@/operations/normalize';
export { fadeIn, fadeOut } from '@/operations/fade';
export { reverseSamples } from '@/operations/reverse';
