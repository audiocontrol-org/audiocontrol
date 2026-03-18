/**
 * Type declarations for @audiocontrol/sampler-library.
 *
 * These declarations cover only the types used by the loop-editor module.
 * The full library ships JS bundles; once its DTS build is fixed upstream,
 * this file can be removed in favor of the published declarations.
 */

declare module '@audiocontrol/sampler-library' {
  export interface LoopCandidate {
    loopStart: number;
    loopEnd: number;
    nccScore: number;
    spectralScore: number;
    slopeScore: number;
    combinedScore: number;
  }

  export interface SearchConfig {
    minLoopLength: number;
    maxLoopLength: number;
    candidateCount: number;
    nccWindowSize: number;
    spectralWindowSize: number;
    endPointSearchRadius: number;
    loopStartSearchRadius: number;
    weights: {
      ncc: number;
      spectral: number;
      slope: number;
    };
  }
}

declare module '@audiocontrol/sampler-library/browser' {
  import type { LoopCandidate, SearchConfig } from '@audiocontrol/sampler-library';

  export function searchLoopPoints(
    samples: Int16Array,
    sampleRate: number,
    targetEndPoint?: number,
    config?: Partial<SearchConfig>,
    onProgress?: (percent: number, stage: string) => void,
  ): LoopCandidate[];

  export function createSmoothedCopy(
    samples: Int16Array,
    loopPoint: number,
    endPoint: number,
    options?: { mode?: 'linear' | 'equal-power'; crossfadeLength?: number },
  ): Int16Array;
}
