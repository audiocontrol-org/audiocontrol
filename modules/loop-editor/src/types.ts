/**
 * Shared types for the loop editor module.
 */

export type { LoopCandidate, SearchConfig } from '@audiocontrol/sampler-library';

/**
 * Progress state for loop detection search.
 */
export interface LoopDetectionProgress {
  /** Completion percentage (0-100). */
  percent: number;
  /** Current processing stage description. */
  stage: string;
}
