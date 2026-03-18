/**
 * Web Worker for loop point detection.
 *
 * Runs the CPU-intensive loop point search algorithm off the main
 * thread to avoid blocking the UI during analysis.
 */

import type { SearchConfig, LoopCandidate } from '@audiocontrol/sampler-library';
import { searchLoopPoints } from '@audiocontrol/sampler-library/browser';

export interface WorkerSearchRequest {
  type: 'search';
  samples: Int16Array;
  sampleRate: number;
  targetEndPoint?: number;
  config?: Partial<SearchConfig>;
}

export interface WorkerProgress {
  type: 'progress';
  percent: number;
  stage: string;
}

export interface WorkerComplete {
  type: 'complete';
  candidates: LoopCandidate[];
}

export interface WorkerError {
  type: 'error';
  message: string;
}

export type WorkerResponse = WorkerProgress | WorkerComplete | WorkerError;

self.onmessage = (event: MessageEvent<WorkerSearchRequest>) => {
  const { type, samples, sampleRate, targetEndPoint, config } = event.data;

  if (type !== 'search') return;

  try {
    const onProgress = (percent: number, stage: string) => {
      const message: WorkerProgress = { type: 'progress', percent, stage };
      self.postMessage(message);
    };

    const candidates = searchLoopPoints(
      samples,
      sampleRate,
      targetEndPoint,
      config,
      onProgress,
    );

    const message: WorkerComplete = { type: 'complete', candidates };
    self.postMessage(message);
  } catch (error) {
    const message: WorkerError = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(message);
  }
};

export {};
