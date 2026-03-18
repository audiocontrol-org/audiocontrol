/**
 * React hook for loop point detection using a Web Worker.
 *
 * This hook manages the lifecycle of the loop detection worker and provides
 * state for tracking progress and results.
 */

import { useCallback, useRef, useState } from 'react';
import type { LoopCandidate, SearchConfig } from '@audiocontrol/sampler-library';
import type {
  WorkerSearchRequest,
  WorkerResponse,
} from '@/workers/loop-detection.worker';

/**
 * Progress state for the loop detection search.
 */
export interface LoopDetectionProgress {
  /**
   * Completion percentage (0-100).
   */
  percent: number;

  /**
   * Current processing stage description.
   */
  stage: string;
}

/**
 * Return type of the useLoopDetection hook.
 */
export interface UseLoopDetectionResult {
  /**
   * Whether a search is currently in progress.
   */
  isSearching: boolean;

  /**
   * Current search progress.
   */
  progress: LoopDetectionProgress;

  /**
   * Loop point candidates from the most recent search.
   */
  candidates: LoopCandidate[];

  /**
   * Error message if the search failed.
   */
  error: string | null;

  /**
   * Start a new loop point search.
   */
  searchLoopPoints: (
    samples: Int16Array,
    sampleRate: number,
    targetEndPoint?: number,
    config?: Partial<SearchConfig>
  ) => void;

  /**
   * Cancel an in-progress search.
   */
  cancelSearch: () => void;

  /**
   * Clear results and error state.
   */
  clearResults: () => void;
}

/**
 * Hook for running loop point detection in a Web Worker.
 *
 * @example
 * ```tsx
 * function LoopEditor({ samples, sampleRate }) {
 *   const {
 *     isSearching,
 *     progress,
 *     candidates,
 *     searchLoopPoints,
 *     cancelSearch,
 *   } = useLoopDetection();
 *
 *   const handleAutoDetect = () => {
 *     searchLoopPoints(samples, sampleRate);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleAutoDetect} disabled={isSearching}>
 *         Auto-Detect
 *       </button>
 *       {isSearching && <ProgressBar value={progress.percent} />}
 *       {candidates.map((c, i) => (
 *         <CandidateMarker key={i} candidate={c} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
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
      config?: Partial<SearchConfig>
    ) => {
      // Terminate any existing worker
      terminateWorker();

      // Reset state
      setIsSearching(true);
      setProgress({ percent: 0, stage: 'Starting...' });
      setCandidates([]);
      setError(null);

      // Create new worker
      // Vite handles the ?worker import syntax for bundling
      const worker = new Worker(
        new URL('@/workers/loop-detection.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      // Handle messages from worker
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

      // Handle worker errors
      worker.onerror = (event) => {
        setError(event.message || 'Worker error');
        setIsSearching(false);
        terminateWorker();
      };

      // Start the search
      const request: WorkerSearchRequest = {
        type: 'search',
        samples,
        sampleRate,
        targetEndPoint,
        config,
      };

      // Use transferable for zero-copy transfer of samples
      worker.postMessage(request, [samples.buffer]);
    },
    [terminateWorker]
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
