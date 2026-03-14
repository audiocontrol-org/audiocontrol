/**
 * Web Worker for loop point detection.
 *
 * This worker runs the CPU-intensive loop point search algorithm off the main
 * thread to avoid blocking the UI during analysis.
 */

import {
  searchLoopPoints,
  type SearchConfig,
  type LoopCandidate,
} from '@audiocontrol/sampler-library/browser';

/**
 * Message sent to the worker to start a search.
 */
export interface WorkerSearchRequest {
  type: 'search';

  /**
   * Audio samples as 16-bit signed integers.
   */
  samples: Int16Array;

  /**
   * Sample rate in Hz (15000 or 30000 for S-330/S-550).
   */
  sampleRate: number;

  /**
   * Target end point around which to search for loop end candidates.
   */
  targetEndPoint?: number;

  /**
   * Search configuration options.
   */
  config?: Partial<SearchConfig>;
}

/**
 * Progress update from the worker.
 */
export interface WorkerProgress {
  type: 'progress';
  percent: number;
  stage: string;
}

/**
 * Search completion message from the worker.
 */
export interface WorkerComplete {
  type: 'complete';
  candidates: LoopCandidate[];
}

/**
 * Error message from the worker.
 */
export interface WorkerError {
  type: 'error';
  message: string;
}

/**
 * All possible messages from the worker.
 */
export type WorkerResponse = WorkerProgress | WorkerComplete | WorkerError;

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerSearchRequest>) => {
  const { type, samples, sampleRate, targetEndPoint, config } = event.data;

  if (type !== 'search') {
    return;
  }

  try {
    // Progress callback to report back to main thread
    const onProgress = (percent: number, stage: string) => {
      const message: WorkerProgress = { type: 'progress', percent, stage };
      self.postMessage(message);
    };

    // Run the search
    const candidates = searchLoopPoints(
      samples,
      sampleRate,
      targetEndPoint,
      config,
      onProgress
    );

    // Send results
    const message: WorkerComplete = { type: 'complete', candidates };
    self.postMessage(message);
  } catch (error) {
    // Send error
    const message: WorkerError = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
};

// Export type for TypeScript module recognition
export {};
