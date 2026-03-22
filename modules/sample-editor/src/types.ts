/** A pure sample editing operation. */
export type SampleOperation = (samples: Int16Array, sampleRate: number) => Int16Array;

/** Fade curve shape. */
export type FadeCurve = 'linear' | 'equal-power' | 'logarithmic';

/** A history entry in the undo/redo stack. */
export interface HistoryEntry {
  label: string;
  samples: Int16Array;
}
