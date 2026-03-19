/**
 * React hook for loop point detection using a Web Worker.
 *
 * Manages the lifecycle of the loop detection worker and provides
 * state for tracking progress and results.
 */

import { useCallback, useRef, useState } from 'react';
import type { LoopCandidate, SearchConfig, LoopDetectionProgress } from '@/types';
import type { WorkerSearchRequest, WorkerResponse } from '@/workers/loop-detection.worker';

export interface UseLoopDetectionResult {
  isSearching: boolean;
  progress: LoopDetectionProgress;
  candidates: LoopCandidate[];
  error: string | null;
  searchLoopPoints: (
    samples: Int16Array,
    sampleRate: number,
    targetEndPoint?: number,
    config?: Partial<SearchConfig>,
  ) => void;
  cancelSearch: () => void;
  clearResults: () => void;
}

export function useLoopDetection(): UseLoopDetectionResult {
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<LoopDetectionProgress>({
    percent: 0,
    stage: '',
  });
  const [candidates, setCandidates] = useState<LoopCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const searchLoopPoints = useCallback(
    (
      samples: Int16Array,
      sampleRate: number,
      targetEndPoint?: number,
      config?: Partial<SearchConfig>,
    ) => {
      terminateWorker();

      setIsSearching(true);
      setProgress({ percent: 0, stage: 'Starting...' });
      setCandidates([]);
      setError(null);

      const worker = new Worker(
        new URL('../workers/loop-detection.worker.js', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;

        switch (response.type) {
          case 'progress':
            setProgress({
              percent: response.percent,
              stage: response.stage,
            });
            break;

          case 'complete':
            setCandidates(response.candidates);
            setIsSearching(false);
            terminateWorker();
            break;

          case 'error':
            setError(response.message);
            setIsSearching(false);
            terminateWorker();
            break;
        }
      };

      worker.onerror = (event) => {
        setError(event.message || 'Worker error');
        setIsSearching(false);
        terminateWorker();
      };

      const request: WorkerSearchRequest = {
        type: 'search',
        samples,
        sampleRate,
        targetEndPoint,
        config,
      };

      worker.postMessage(request, [samples.buffer]);
    },
    [terminateWorker],
  );

  const cancelSearch = useCallback(() => {
    if (isSearching) {
      terminateWorker();
      setIsSearching(false);
      setProgress({ percent: 0, stage: '' });
    }
  }, [isSearching, terminateWorker]);

  const clearResults = useCallback(() => {
    setCandidates([]);
    setError(null);
    setProgress({ percent: 0, stage: '' });
  }, []);

  return {
    isSearching,
    progress,
    candidates,
    error,
    searchLoopPoints,
    cancelSearch,
    clearResults,
  };
}
